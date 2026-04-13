#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  SIGNAGE SYSTEM — INSTALLER
#  github.com/patrikaeberli/viewer
#
#  Modes:
#    1) SERVER   — Apache + PHP web server only (admin + display pages)
#    2) CLIENT   — Chromium kiosk browser only (points to a remote server)
#    3) BOTH     — Server + Client on the same device (standalone unit)
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────

RED='\033[0;31m';  GREEN='\033[0;32m';  YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m';      RESET='\033[0m'

info()    { echo -e "${CYAN}  ▸ $*${RESET}"; }
success() { echo -e "${GREEN}  ✔ $*${RESET}"; }
warn()    { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
error()   { echo -e "${RED}  ✘ $*${RESET}"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}\n"; }

# ── Root check ────────────────────────────────────────────────────────────────

if [[ $EUID -ne 0 ]]; then
  error "Please run as root:  sudo bash install.sh"
fi

# ── Config defaults ───────────────────────────────────────────────────────────

REPO_URL="https://github.com/patrikaeberli/viewer"
INSTALL_DIR="/var/www/signage"
WEB_USER="www-data"
APACHE_CONF="/etc/apache2/sites-available/signage.conf"
SERVICE_CLIENT="signage-kiosk"
SERVICE_UPDATE="signage-update"
CLIENT_URL=""          # filled in during setup
INSTALL_MODE=""        # server | client | both
SERVER_IP=""           # used when mode=client to point browser at remote server

# ── Banner ────────────────────────────────────────────────────────────────────

clear
echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║         SIGNAGE SYSTEM  INSTALLER         ║"
echo "  ║       github.com/patrikaeberli/viewer      ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  Running on: $(uname -n)  |  $(uname -m)  |  $(grep PRETTY /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '\"')\n"

# ── Mode selection ────────────────────────────────────────────────────────────

header "Installation Mode"
echo -e "  ${BOLD}1)${RESET} SERVER   — Web server only"
echo -e "             Apache + PHP, hosts admin & display pages"
echo -e "             Ideal for a headless server / NAS / Pi in a rack\n"
echo -e "  ${BOLD}2)${RESET} CLIENT   — Kiosk display only"
echo -e "             Chromium in fullscreen kiosk mode"
echo -e "             Points to a remote signage server\n"
echo -e "  ${BOLD}3)${RESET} BOTH     — Server + Client on this device"
echo -e "             Standalone unit (Pi connected to a screen)"
echo -e "             Runs both the web server and the kiosk browser\n"

while true; do
  read -rp "  Select mode [1/2/3]: " choice
  case "$choice" in
    1) INSTALL_MODE="server"; break ;;
    2) INSTALL_MODE="client"; break ;;
    3) INSTALL_MODE="both";   break ;;
    *) warn "Please enter 1, 2, or 3." ;;
  esac
done

echo ""
success "Mode: ${INSTALL_MODE^^}"

# ── Client URL ────────────────────────────────────────────────────────────────

if [[ "$INSTALL_MODE" == "client" ]]; then
  header "Server Address"
  echo -e "  Enter the IP or hostname of the signage server."
  echo -e "  Example:  192.168.1.50   or   signage.local\n"
  while true; do
    read -rp "  Server address: " SERVER_IP
    [[ -n "$SERVER_IP" ]] && break
    warn "Cannot be empty."
  done
  CLIENT_URL="http://${SERVER_IP}/index.php"
fi

if [[ "$INSTALL_MODE" == "both" ]]; then
  CLIENT_URL="http://localhost/index.php"
fi

# ── System update ─────────────────────────────────────────────────────────────

header "System Update"
info "Updating package lists…"
apt-get update -qq
success "Package lists updated"

# ═══════════════════════════════════════════════════════════════════════════════
#  SERVER INSTALLATION
# ═══════════════════════════════════════════════════════════════════════════════

install_server() {
  header "Installing Server Components"

  # ── Apache + PHP ──
  info "Installing Apache and PHP…"
  apt-get install -y -qq \
    apache2 \
    php \
    php-cli \
    libapache2-mod-php \
    git \
    curl \
    unzip \
    > /dev/null 2>&1
  success "Apache and PHP installed"

  # ── Enable Apache modules ──
  info "Enabling Apache modules…"
  a2enmod rewrite > /dev/null 2>&1
  a2enmod headers > /dev/null 2>&1
  success "Apache modules enabled"

  # ── Clone / update repo ──
  header "Deploying Application"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Existing installation found — pulling latest version…"
    git -C "$INSTALL_DIR" pull --ff-only
    success "Repository updated"
  else
    info "Cloning repository to ${INSTALL_DIR}…"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR"
    success "Repository cloned"
  fi

  # ── File permissions ──
  info "Setting file permissions…"
  chown -R "${WEB_USER}:${WEB_USER}" "$INSTALL_DIR"
  chmod -R 755 "$INSTALL_DIR"
  mkdir -p "${INSTALL_DIR}/assets"
  chmod 775 "${INSTALL_DIR}/assets"
  # state.json must be writable by PHP
  touch "${INSTALL_DIR}/state.json"
  chmod 664 "${INSTALL_DIR}/state.json"
  chown "${WEB_USER}:${WEB_USER}" "${INSTALL_DIR}/state.json"
  success "Permissions set"

  # ── Apache virtual host ──
  info "Configuring Apache virtual host…"
  cat > "$APACHE_CONF" << 'APACHECONF'
<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/signage

    <Directory /var/www/signage>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Security headers
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"

    ErrorLog ${APACHE_LOG_DIR}/signage_error.log
    CustomLog ${APACHE_LOG_DIR}/signage_access.log combined
</VirtualHost>
APACHECONF

  a2dissite 000-default.conf > /dev/null 2>&1 || true
  a2ensite signage.conf       > /dev/null 2>&1
  systemctl enable apache2    > /dev/null 2>&1
  systemctl restart apache2
  success "Apache configured and started"

  # ── Auto-update service (optional) ──
  info "Installing auto-update systemd timer (daily git pull)…"
  cat > "/etc/systemd/system/${SERVICE_UPDATE}.service" << UPDATESERVICE
[Unit]
Description=Signage — auto update from GitHub
After=network-online.target

[Service]
Type=oneshot
User=root
ExecStart=/usr/bin/git -C ${INSTALL_DIR} pull --ff-only
ExecStartPost=/bin/chown -R ${WEB_USER}:${WEB_USER} ${INSTALL_DIR}
StandardOutput=journal
StandardError=journal
UPDATESERVICE

  cat > "/etc/systemd/system/${SERVICE_UPDATE}.timer" << UPDATETIMER
[Unit]
Description=Signage — daily auto-update timer

[Timer]
OnCalendar=*-*-* 03:00:00
RandomizedDelaySec=600
Persistent=true

[Install]
WantedBy=timers.target
UPDATETIMER

  systemctl daemon-reload          > /dev/null 2>&1
  systemctl enable "${SERVICE_UPDATE}.timer" > /dev/null 2>&1
  systemctl start  "${SERVICE_UPDATE}.timer" > /dev/null 2>&1
  success "Auto-update timer installed (runs daily at 03:00)"
}

# ═══════════════════════════════════════════════════════════════════════════════
#  CLIENT INSTALLATION
# ═══════════════════════════════════════════════════════════════════════════════

install_client() {
  header "Installing Client / Kiosk Components"

  # ── Dependencies ──
  info "Installing Chromium and display dependencies…"
  apt-get install -y -qq \
    chromium-browser \
    xserver-xorg \
    x11-xserver-utils \
    xinit \
    openbox \
    unclutter \
    > /dev/null 2>&1 || \
  apt-get install -y -qq \
    chromium \
    xserver-xorg \
    x11-xserver-utils \
    xinit \
    openbox \
    unclutter \
    > /dev/null 2>&1
  success "Chromium and X11 installed"

  # ── Detect or create kiosk user ──
  KIOSK_USER="kiosk"
  if ! id "$KIOSK_USER" &>/dev/null; then
    info "Creating kiosk user…"
    useradd -m -s /bin/bash "$KIOSK_USER"
    success "User 'kiosk' created"
  else
    info "User 'kiosk' already exists"
  fi

  # ── Chromium: disable first-run / crash restore dialogs ──
  CHROME_PREFS_DIR="/home/${KIOSK_USER}/.config/chromium/Default"
  mkdir -p "$CHROME_PREFS_DIR"
  cat > "${CHROME_PREFS_DIR}/Preferences" << 'CHROMEPREFS'
{
  "browser": { "check_default_browser": false },
  "session": { "restore_on_startup": 4, "startup_urls": [] },
  "profile": { "exit_type": "Normal", "exited_cleanly": true },
  "safebrowsing": { "enabled": false }
}
CHROMEPREFS
  chown -R "${KIOSK_USER}:${KIOSK_USER}" "/home/${KIOSK_USER}/.config"
  success "Chromium preferences set"

  # ── Openbox autostart ──
  OPENBOX_DIR="/home/${KIOSK_USER}/.config/openbox"
  mkdir -p "$OPENBOX_DIR"
  cat > "${OPENBOX_DIR}/autostart" << OBSTART
# Disable screen blanking and power management
xset s off
xset s noblank
xset -dpms

# Hide mouse cursor after 0.5s of inactivity
unclutter -idle 0.5 -root &

# Launch Chromium in kiosk mode
chromium-browser \\
  --kiosk \\
  --noerrdialogs \\
  --disable-infobars \\
  --disable-translate \\
  --disable-features=TranslateUI \\
  --disable-restore-session-state \\
  --disable-session-crashed-bubble \\
  --disable-component-update \\
  --check-for-update-interval=31536000 \\
  --autoplay-policy=no-user-gesture-required \\
  --start-fullscreen \\
  --window-position=0,0 \\
  "${CLIENT_URL}" &
OBSTART

  chown -R "${KIOSK_USER}:${KIOSK_USER}" "$OPENBOX_DIR"
  success "Openbox autostart configured"

  # ── Systemd service for kiosk ──
  info "Creating kiosk systemd service…"
  cat > "/etc/systemd/system/${SERVICE_CLIENT}.service" << KIOSKSERVICE
[Unit]
Description=Signage Kiosk — Chromium fullscreen display
After=graphical.target network-online.target
Wants=network-online.target

[Service]
User=${KIOSK_USER}
Group=${KIOSK_USER}
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/${KIOSK_USER}/.Xauthority
ExecStart=/usr/bin/startx /usr/bin/openbox-session -- :0 vt1
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=graphical.target
KIOSKSERVICE

  systemctl daemon-reload                   > /dev/null 2>&1
  systemctl enable "${SERVICE_CLIENT}.service" > /dev/null 2>&1
  success "Kiosk service installed and enabled"

  # ── Disable screen blanking at system level ──
  info "Disabling screensaver / display sleep…"
  if [[ -f /etc/lightdm/lightdm.conf ]]; then
    sed -i 's/#xserver-command=X/xserver-command=X -s 0 -dpms/' /etc/lightdm/lightdm.conf 2>/dev/null || true
  fi

  # Raspberry Pi specific: disable HDMI blanking
  BOOT_CONFIG="/boot/config.txt"
  [[ -f /boot/firmware/config.txt ]] && BOOT_CONFIG="/boot/firmware/config.txt"
  if [[ -f "$BOOT_CONFIG" ]]; then
    if ! grep -q "hdmi_blanking" "$BOOT_CONFIG"; then
      echo -e "\n# Signage — disable HDMI blanking\nhdmi_blanking=2" >> "$BOOT_CONFIG"
      success "HDMI blanking disabled in ${BOOT_CONFIG}"
    fi
  fi

  # Raspberry Pi: autologin to tty1
  if command -v raspi-config &>/dev/null; then
    info "Configuring Raspberry Pi autologin…"
    mkdir -p /etc/systemd/system/getty@tty1.service.d
    cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << AUTOLOGIN
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${KIOSK_USER} --noclear %I \$TERM
AUTOLOGIN
    systemctl daemon-reload > /dev/null 2>&1
    success "Raspberry Pi autologin configured for user '${KIOSK_USER}'"
  fi

  success "Client/kiosk installation complete"
}

# ═══════════════════════════════════════════════════════════════════════════════
#  RUN SELECTED MODE
# ═══════════════════════════════════════════════════════════════════════════════

case "$INSTALL_MODE" in
  server)
    install_server
    ;;
  client)
    install_client
    ;;
  both)
    install_server
    install_client
    ;;
esac

# ═══════════════════════════════════════════════════════════════════════════════
#  SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

header "Installation Complete"

LOCAL_IP=$(hostname -I | awk '{print $1}')

case "$INSTALL_MODE" in
  server)
    echo -e "  ${GREEN}${BOLD}Server is ready!${RESET}\n"
    echo -e "  Admin editor : ${CYAN}http://${LOCAL_IP}/admin.php${RESET}"
    echo -e "  Display page : ${CYAN}http://${LOCAL_IP}/index.php${RESET}"
    echo -e "  Settings     : ${CYAN}http://${LOCAL_IP}/settings.php${RESET}\n"
    echo -e "  Files live in: ${INSTALL_DIR}"
    echo -e "  Assets folder: ${INSTALL_DIR}/assets\n"
    echo -e "  Auto-update  : daily at 03:00 via systemd timer"
    echo -e "                 ${YELLOW}systemctl status ${SERVICE_UPDATE}.timer${RESET}\n"
    ;;
  client)
    echo -e "  ${GREEN}${BOLD}Kiosk is ready!${RESET}\n"
    echo -e "  Displaying   : ${CYAN}${CLIENT_URL}${RESET}"
    echo -e "  Service      : ${YELLOW}systemctl status ${SERVICE_CLIENT}${RESET}\n"
    echo -e "  ${YELLOW}Reboot to start the kiosk display.${RESET}\n"
    ;;
  both)
    echo -e "  ${GREEN}${BOLD}Standalone unit ready!${RESET}\n"
    echo -e "  Admin editor : ${CYAN}http://${LOCAL_IP}/admin.php${RESET}"
    echo -e "  Display page : ${CYAN}http://${LOCAL_IP}/index.php${RESET}"
    echo -e "  Settings     : ${CYAN}http://${LOCAL_IP}/settings.php${RESET}\n"
    echo -e "  Kiosk URL    : ${CYAN}${CLIENT_URL}${RESET}"
    echo -e "  Files live in: ${INSTALL_DIR}\n"
    echo -e "  Services:"
    echo -e "    ${YELLOW}systemctl status apache2${RESET}"
    echo -e "    ${YELLOW}systemctl status ${SERVICE_CLIENT}${RESET}"
    echo -e "    ${YELLOW}systemctl status ${SERVICE_UPDATE}.timer${RESET}\n"
    echo -e "  ${YELLOW}Reboot to start the kiosk display.${RESET}\n"
    ;;
esac

echo -e "  ─────────────────────────────────────────────"
echo -e "  Useful commands:\n"
echo -e "    Update now     :  ${CYAN}git -C ${INSTALL_DIR} pull${RESET}"
echo -e "    Apache logs    :  ${CYAN}tail -f /var/log/apache2/signage_error.log${RESET}"
echo -e "    Kiosk logs     :  ${CYAN}journalctl -u ${SERVICE_CLIENT} -f${RESET}"
echo -e "    Restart server :  ${CYAN}systemctl restart apache2${RESET}"
echo -e "    Restart kiosk  :  ${CYAN}systemctl restart ${SERVICE_CLIENT}${RESET}"
echo -e "  ─────────────────────────────────────────────\n"

# ── Prompt reboot ─────────────────────────────────────────────────────────────

if [[ "$INSTALL_MODE" != "server" ]]; then
  echo ""
  read -rp "  Reboot now to start the kiosk? [y/N]: " do_reboot
  if [[ "$do_reboot" =~ ^[Yy]$ ]]; then
    info "Rebooting…"
    sleep 2
    reboot
  else
    warn "Remember to reboot before the kiosk display will start."
  fi
fi
