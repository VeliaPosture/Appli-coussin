"""
coussin_ble_3zones.py - Envoie les 3 capteurs au téléphone par Bluetooth.

Format envoyé chaque seconde (une ligne de texte) : FG,FD,DOS_G
Exemple : 1820,1650,430
"""

import bluetooth                    # Bluetooth Low Energy (inclus dans MicroPython)
import network                      # pour s'assurer que le WiFi est éteint
import ubinascii                    # pour créer un nom unique
from micropython import const
from machine import Pin, I2C, ADC
import ssd1306
import time

# --- Zones branchées : (nom, broche) ---
ZONES = [
    ("FG", 34),       # fesse gauche (FSR408)
    ("FD", 35),       # fesse droite (FSR408)
    ("DOS_G", 36),    # dos gauche   (FSR402B, pastille ronde), broche VP
]
NB_LECTURES = 10           # lectures moyennées pour lisser
intervalle_ms = 1000       # une mesure par seconde (modifiable depuis le téléphone)
BROCHE_MOTEUR = 25         # D25 : entrée IN (ou SIG) du module vibrant
DUREE_VIBRATION_MS = 400   # durée d'une vibration
PAUSE_VIBRATION_MS = 250   # pause entre deux vibrations

# --- Codes des événements Bluetooth (définis par MicroPython) ---
_IRQ_CENTRAL_CONNECT = const(1)
_IRQ_CENTRAL_DISCONNECT = const(2)
_IRQ_GATTS_WRITE = const(3)

# --- Permissions des caractéristiques ---
_FLAG_READ = const(0x0002)
_FLAG_WRITE_NO_RESPONSE = const(0x0004)
_FLAG_WRITE = const(0x0008)
_FLAG_NOTIFY = const(0x0010)

# --- Nordic UART Service : identifiants standards (UUID) ---
_UART_UUID = bluetooth.UUID("6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
_UART_TX = (bluetooth.UUID("6E400003-B5A3-F393-E0A9-E50E24DCCA9E"),
            _FLAG_READ | _FLAG_NOTIFY)                      # coussin -> téléphone
_UART_RX = (bluetooth.UUID("6E400002-B5A3-F393-E0A9-E50E24DCCA9E"),
            _FLAG_WRITE | _FLAG_WRITE_NO_RESPONSE)          # téléphone -> coussin
_UART_SERVICE = (_UART_UUID, (_UART_TX, _UART_RX))

# --- WiFi éteint : le Bluetooth fonctionne seul ---
network.WLAN(network.STA_IF).active(False)

# --- Écran et capteurs ---
i2c = I2C(0, scl=Pin(22), sda=Pin(21), freq=400000)
oled = ssd1306.SSD1306_I2C(128, 64, i2c)

adcs = []
for nom, broche in ZONES:
    a = ADC(Pin(broche))
    a.atten(ADC.ATTN_11DB)
    adcs.append(a)

connexions = set()         # téléphones connectés


def creer_annonce(nom):
    """Annonce principale (31 octets max) : « Je m'appelle Coussin-XXXX »."""
    nom_b = nom.encode()
    annonce = bytearray(b"\x02\x01\x06")                   # appareil BLE seulement
    annonce += bytes((len(nom_b) + 1, 0x09)) + nom_b        # le nom
    return annonce


def creer_reponse(uuid):
    """Réponse envoyée à qui demande plus d'infos : « j'offre un service UART »."""
    uuid_b = bytes(uuid)
    return bytes((len(uuid_b) + 1, 0x07)) + uuid_b


def annoncer():
    """Diffuse l'annonce toutes les 100 ms pour que le téléphone trouve le coussin."""
    ble.gap_advertise(100_000,
                      adv_data=creer_annonce(NOM_BLE),
                      resp_data=creer_reponse(_UART_UUID))


def traiter_commande(commande):
    """Commande reçue du téléphone.
    I=500 -> deux mesures par seconde
    V=3   -> vibrer 3 fois (rappel de l'application)"""
    global intervalle_ms, vibrations_a_faire
    if commande.startswith("V="):
        try:
            vibrations_a_faire = max(0, min(5, int(commande[2:])))   # au plus 5 vibrations
            print("Vibrer", vibrations_a_faire, "fois")
        except ValueError:
            print("Commande invalide :", commande)
    elif commande.startswith("I="):
        try:
            valeur = int(commande[2:])
            if 200 <= valeur <= 60000:
                intervalle_ms = valeur
                print("Nouvel intervalle :", valeur, "ms")
        except ValueError:
            print("Commande invalide :", commande)


def evenement_ble(evenement, donnees):
    """Appelée automatiquement par l'ESP32 à chaque événement Bluetooth."""
    if evenement == _IRQ_CENTRAL_CONNECT:
        conn, _, _ = donnees
        connexions.add(conn)
        print("Téléphone connecté")
    elif evenement == _IRQ_CENTRAL_DISCONNECT:
        conn, _, _ = donnees
        connexions.discard(conn)
        print("Téléphone déconnecté")
        annoncer()                     # redevient visible pour une reconnexion
    elif evenement == _IRQ_GATTS_WRITE:
        conn, handle = donnees
        if handle == handle_rx:
            commande = ble.gatts_read(handle_rx).decode().strip()
            print("Commande reçue :", commande)
            traiter_commande(commande)


def lire(adc):
    """Moyenne de plusieurs lectures (0 à 4095)."""
    total = 0
    for _ in range(NB_LECTURES):
        total += adc.read()
        time.sleep_ms(2)
    return total // NB_LECTURES


# ===================== DÉMARRAGE DU BLUETOOTH =====================
ble = bluetooth.BLE()
ble.active(True)

mac = ble.config("mac")[1]                                   # adresse unique de la puce
NOM_BLE = "Coussin-" + ubinascii.hexlify(mac[-2:]).decode().upper()

ble.irq(evenement_ble)
((handle_tx, handle_rx),) = ble.gatts_register_services((_UART_SERVICE,))
annoncer()
print("Bluetooth actif : cherche « {} » dans l'application".format(NOM_BLE))

# ===================== VIBRATION =====================
# Le moteur (module vibrant sur D25) et la LED bleue de la carte (GPIO2)
# vibrent / clignotent ensemble : en attendant le moteur, la LED montre
# que la commande est bien reçue.
moteur = Pin(BROCHE_MOTEUR, Pin.OUT, value=0)
led = Pin(2, Pin.OUT, value=0)
vibrations_a_faire = 0     # rempli par la commande V=n (dans traiter_commande)


def vibrer(n):
    """Fait n vibrations courtes. Appelée dans la boucle principale, jamais
    dans evenement_ble (qui doit rester très court)."""
    for i in range(n):
        moteur.on()
        led.on()
        time.sleep_ms(DUREE_VIBRATION_MS)
        moteur.off()
        led.off()
        if i < n - 1:
            time.sleep_ms(PAUSE_VIBRATION_MS)


# ===================== BOUCLE PRINCIPALE =====================
while True:
    if vibrations_a_faire:
        n = vibrations_a_faire
        vibrations_a_faire = 0
        vibrer(n)

    valeurs = [lire(a) for a in adcs]

    # Envoi au téléphone : une ligne « FG,FD,DOS_G »
    message = ",".join(str(v) for v in valeurs) + "\n"
    ble.gatts_write(handle_tx, message)
    for conn in connexions:
        try:
            ble.gatts_notify(conn, handle_tx, message)
        except OSError:
            pass                       # téléphone parti entre-temps : on ignore

    # Écran : nom du coussin, état de la connexion, puis une ligne par zone
    oled.fill(0)
    oled.text(NOM_BLE, 0, 0)
    oled.text("Connecte" if connexions else "En attente", 0, 10)
    y = 26
    for (nom, broche), v in zip(ZONES, valeurs):
        oled.text("{:<5}{:>4}".format(nom, v), 0, y)
        oled.rect(78, y, 50, 7, 1)
        oled.fill_rect(78, y, int(v / 4095 * 50), 7, 1)
        y += 13
    oled.show()

    # Shell et Traceur de Thonny
    print(message.strip())

    time.sleep_ms(intervalle_ms)
