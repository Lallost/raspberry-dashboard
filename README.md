# Raspberry Dashboard

Dashboard web sviluppata in Python/Flask per monitorare in tempo reale lo stato del Raspberry Pi e dei servizi installati.

## 🚀 Funzionalità
- Monitoraggio CPU, RAM e temperatura del Raspberry
- Stato dei servizi (Navidrome, Syncthing, ecc.)
- Aggiornamento automatico dei dati tramite AJAX
- Interfaccia semplice e responsive
- Codice organizzato in Flask + HTML/CSS/JS

## 📁 Struttura del progetto
/dashboard
│
├── app.py                 # Server Flask
├── services_status.sh     # Script per controllare i servizi
│
├── templates/
│   └── index.html         # Pagina principale della dashboard
│
└── static/
├── style.css          # Stili grafici
└── script.js          # Logica frontend (AJAX, aggiornamenti)


## 🧰 Requisiti
- Python 3
- Flask
- Raspberry Pi OS (o qualsiasi Linux)
- Permessi per eseguire `services_status.sh`

Installa Flask:
pip install flask


## ▶️ Avvio della dashboard
Nella cartella del progetto:
python3 app.py

La dashboard sarà disponibile su:
http://100.64.55.102:8080/


## 🔧 Configurazione servizi
Lo script `services_status.sh` controlla lo stato dei servizi tramite:
systemctl is-active nome_servizio


Puoi aggiungere o rimuovere servizi modificando lo script.

## 🗂 Versionamento con Git
Per salvare modifiche:
git add .
git commit -m "Descrizione modifica"
git push


## 📌 Note
- Il progetto è pensato per essere leggero e sempre attivo sul Raspberry.
- Puoi personalizzare grafici, colori e layout modificando `style.css` e `script.js`.

## 📜 Licenza
MIT License




