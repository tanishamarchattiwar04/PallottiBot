from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import random
import json
import os
import mysql.connector
from datetime import datetime

app = Flask(__name__, static_folder='.')
CORS(app)

# ════════════════════════════════════════════════════════
#  MySQL DATABASE CONFIG — update with your credentials
# ════════════════════════════════════════════════════════
DB_CONFIG = {
    "host":     "localhost",
    "user":     "root",          # your MySQL Workbench username
    "password": "Tanisha#2006",  # your MySQL Workbench password
    "database": "pallottibot"
}

def get_db():
    return mysql.connector.connect(**DB_CONFIG)

# ════════════════════════════════════════════════════════
#  AUTO-CREATE TABLES ON STARTUP
# ════════════════════════════════════════════════════════
def init_db():
    try:
        conn = get_db()
        cur  = conn.cursor()

        # Users table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                username     VARCHAR(50)  UNIQUE NOT NULL,
                password     VARCHAR(255) NOT NULL,
                full_name    VARCHAR(100) NOT NULL,
                email        VARCHAR(100),
                phone        VARCHAR(20),
                department   VARCHAR(50),
                year         VARCHAR(10),
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Chat history table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                username   VARCHAR(50) NOT NULL,
                role       ENUM('user','bot') NOT NULL,
                message    TEXT NOT NULL,
                language   VARCHAR(10) DEFAULT 'en',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_username (username)
            )
        """)

        # Student info table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS students (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                roll_no      VARCHAR(30) UNIQUE NOT NULL,
                full_name    VARCHAR(100) NOT NULL,
                email        VARCHAR(100),
                phone        VARCHAR(20),
                department   VARCHAR(50),
                year         VARCHAR(10),
                cgpa         DECIMAL(4,2),
                fees_paid    BOOLEAN DEFAULT FALSE,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()
        cur.close()
        conn.close()
        print("✅ Database initialized successfully.")
    except Exception as e:
        print(f"⚠️  DB init error: {e}")

init_db()

# ════════════════════════════════════════════════════════
#  MULTILINGUAL KNOWLEDGE BASE
#  Languages: en (English), hi (Hindi), mr (Marathi)
# ════════════════════════════════════════════════════════
knowledge = {

    # ── FEES ──────────────────────────────────────────
    "fees": {
        "en": """💰 **Fee Structure**
• B.E.: ₹1,00,000 – ₹1,30,000 per year
• MBA: ₹80,000 – ₹1,00,000 per year
• Scholarships available (SC/ST/OBC/EWS)
• Hostel & transport charges are separate""",

        "hi": """💰 **शुल्क संरचना**
• बी.ई.: ₹1,00,000 – ₹1,30,000 प्रति वर्ष
• MBA: ₹80,000 – ₹1,00,000 प्रति वर्ष
• छात्रवृत्ति उपलब्ध (SC/ST/OBC/EWS)
• हॉस्टल और परिवहन शुल्क अलग से है""",

        "mr": """💰 **शुल्क रचना**
• बी.ई.: ₹1,00,000 – ₹1,30,000 प्रति वर्ष
• MBA: ₹80,000 – ₹1,00,000 प्रति वर्ष
• शिष्यवृत्ती उपलब्ध (SC/ST/OBC/EWS)
• वसतिगृह व वाहतूक शुल्क वेगळे आहे"""
    },

    # ── COURSES ───────────────────────────────────────
    "courses": {
        "en": """📚 **Courses Offered**
• Computer Science Engineering (CSE)
• Information Technology (IT)
• Electronics & Telecommunication (E&TC)
• Electrical Engineering (EE)
• Mechanical Engineering (ME)
• Civil Engineering (CE)
• MBA (Postgraduate)""",

        "hi": """📚 **उपलब्ध पाठ्यक्रम**
• कंप्यूटर साइंस इंजीनियरिंग (CSE)
• इनफॉर्मेशन टेक्नोलॉजी (IT)
• इलेक्ट्रॉनिक्स और टेलीकम्युनिकेशन (E&TC)
• इलेक्ट्रिकल इंजीनियरिंग (EE)
• मैकेनिकल इंजीनियरिंग (ME)
• सिविल इंजीनियरिंग (CE)
• MBA (स्नातकोत्तर)""",

        "mr": """📚 **उपलब्ध अभ्यासक्रम**
• संगणक शास्त्र अभियांत्रिकी (CSE)
• माहिती तंत्रज्ञान (IT)
• इलेक्ट्रॉनिक्स व दूरसंचार (E&TC)
• विद्युत अभियांत्रिकी (EE)
• यांत्रिक अभियांत्रिकी (ME)
• नागरी अभियांत्रिकी (CE)
• MBA (पदव्युत्तर)"""
    },

    # ── ADMISSION ─────────────────────────────────────
    "admission": {
        "en": """📋 **Admission Process**
• B.E.: Through MHT-CET or JEE Main
• CAP rounds conducted by DTE Maharashtra
• Lateral entry (Direct 2nd Year) available
• Required Documents:
  - 10th & 12th marksheets
  - CET/JEE scorecard
  - Aadhaar & domicile""",

        "hi": """📋 **प्रवेश प्रक्रिया**
• बी.ई.: MHT-CET या JEE Main के माध्यम से
• DTE महाराष्ट्र द्वारा CAP राउंड
• लेटरल एंट्री (सीधे 2nd वर्ष) उपलब्ध
• आवश्यक दस्तावेज़:
  - 10वीं और 12वीं की मार्कशीट
  - CET/JEE स्कोरकार्ड
  - आधार और अधिवास प्रमाण""",

        "mr": """📋 **प्रवेश प्रक्रिया**
• बी.ई.: MHT-CET किंवा JEE Main द्वारे
• DTE महाराष्ट्र मार्फत CAP फेऱ्या
• थेट द्वितीय वर्ष प्रवेश उपलब्ध
• आवश्यक कागदपत्रे:
  - 10वी व 12वीच्या गुणपत्रिका
  - CET/JEE स्कोरकार्ड
  - आधार व अधिवास दाखला"""
    },

    # ── PLACEMENT ─────────────────────────────────────
    "placement": {
        "en": """💼 **Placements**
• Placement rate: 90%+
• Average package: ₹3–5 LPA
• Highest package: ₹10 LPA
• Top recruiters: TCS, Infosys, Wipro, Accenture, Capgemini, Tech Mahindra, Cognizant
• Training: Aptitude, GD, HR interviews""",

        "hi": """💼 **प्लेसमेंट**
• प्लेसमेंट दर: 90%+
• औसत पैकेज: ₹3–5 LPA
• उच्चतम पैकेज: ₹10 LPA
• शीर्ष भर्तीकर्ता: TCS, Infosys, Wipro, Accenture, Capgemini
• प्रशिक्षण: एप्टीट्यूड, GD, HR इंटरव्यू""",

        "mr": """💼 **प्लेसमेंट**
• प्लेसमेंट दर: 90%+
• सरासरी पॅकेज: ₹3–5 LPA
• सर्वोच्च पॅकेज: ₹10 LPA
• प्रमुख भर्ती करणाऱ्या कंपन्या: TCS, Infosys, Wipro, Accenture, Capgemini
• प्रशिक्षण: अॅप्टिट्यूड, GD, HR मुलाखती"""
    },

    # ── HOSTEL ────────────────────────────────────────
    "hostel": {
        "en": """🏠 **Hostel Facilities**
• Separate hostels for boys & girls
• Mess (veg & non-veg)
• 24/7 security & CCTV
• Warden supervision""",

        "hi": """🏠 **हॉस्टल सुविधाएं**
• लड़कों और लड़कियों के लिए अलग हॉस्टल
• मेस (शाकाहारी और मांसाहारी)
• 24/7 सुरक्षा और CCTV
• वार्डन निगरानी""",

        "mr": """🏠 **वसतिगृह सुविधा**
• मुलांसाठी व मुलींसाठी स्वतंत्र वसतिगृह
• मेस (शाकाहारी व मांसाहारी)
• 24/7 सुरक्षा व CCTV
• वॉर्डन देखरेख"""
    },

    # ── CONTACT ───────────────────────────────────────
    "contact": {
        "en": """📞 **Contact Details**
• Phone: +91-712-2801000
• Website: www.svpcet.org
• Email: info@svpcet.org
• Address: Gavsi Manapur, Wardha Road, Nagpur""",

        "hi": """📞 **संपर्क विवरण**
• फोन: +91-712-2801000
• वेबसाइट: www.svpcet.org
• ईमेल: info@svpcet.org
• पता: गावसी माणपुर, वर्धा रोड, नागपुर""",

        "mr": """📞 **संपर्क तपशील**
• फोन: +91-712-2801000
• वेबसाइट: www.svpcet.org
• ईमेल: info@svpcet.org
• पत्ता: गावसी माणपूर, वर्धा रोड, नागपूर"""
    },

    # ── FACILITIES ────────────────────────────────────
    "facilities": {
        "en": """🏛️ **Campus Facilities**
• Advanced Laboratories (AI, ML, Robotics)
• Central Library with e-journals
• Wi-Fi enabled campus
• Sports complex
• Cafeteria (veg & non-veg)
• Auditorium & seminar halls
• College bus service""",

        "hi": """🏛️ **कैंपस सुविधाएं**
• उन्नत प्रयोगशालाएं (AI, ML, रोबोटिक्स)
• ई-जर्नल के साथ केंद्रीय पुस्तकालय
• Wi-Fi सक्षम परिसर
• खेल परिसर
• कैफेटेरिया
• सभागार और सेमिनार हॉल
• कॉलेज बस सेवा""",

        "mr": """🏛️ **कॅम्पस सुविधा**
• प्रगत प्रयोगशाळा (AI, ML, रोबोटिक्स)
• ई-जर्नलसह केंद्रीय ग्रंथालय
• Wi-Fi सक्षम परिसर
• क्रीडा संकुल
• कॅफेटेरिया
• सभागृह व सेमिनार हॉल
• महाविद्यालय बस सेवा"""
    }
}

# ════════════════════════════════════════════════════════
#  LANGUAGE DETECTION
# ════════════════════════════════════════════════════════

# Hindi Unicode range: \u0900–\u097F
# Marathi uses same Devanagari script — we detect by specific Marathi words
MARATHI_WORDS = ["आहे", "आहेत", "कसे", "काय", "मला", "सांगा", "कुठे",
                 "किती", "केव्हा", "नाही", "हे", "ते", "कोणते", "महाविद्यालय"]
HINDI_WORDS   = ["क्या", "कैसे", "कहाँ", "कितना", "बताइए", "मुझे", "है",
                 "हैं", "कॉलेज", "जानकारी", "बताओ", "कब", "कौन"]

def detect_language(text):
    """Returns 'en', 'hi', or 'mr'"""
    # Check for Devanagari script
    has_devanagari = any('\u0900' <= ch <= '\u097F' for ch in text)
    if not has_devanagari:
        return 'en'
    # Distinguish Marathi vs Hindi
    for word in MARATHI_WORDS:
        if word in text:
            return 'mr'
    return 'hi'

# ════════════════════════════════════════════════════════
#  MULTILINGUAL KEYWORD MAPS
# ════════════════════════════════════════════════════════
KEYWORDS = {
    "greeting": {
        "en": ["hi", "hello", "hey", "good morning", "good evening"],
        "hi": ["नमस्ते", "हैलो", "नमस्कार", "हाय"],
        "mr": ["नमस्कार", "हॅलो", "नमस्ते", "हाय"]
    },
    "fees": {
        "en": ["fee", "fees", "cost", "price", "charges", "tuition"],
        "hi": ["फीस", "शुल्क", "फ़ीस", "कितने पैसे", "खर्च"],
        "mr": ["फी", "शुल्क", "किती पैसे", "खर्च"]
    },
    "courses": {
        "en": ["course", "courses", "branch", "program", "department"],
        "hi": ["कोर्स", "पाठ्यक्रम", "शाखा", "विभाग", "ब्रांच"],
        "mr": ["अभ्यासक्रम", "कोर्स", "शाखा", "विभाग"]
    },
    "admission": {
        "en": ["admission", "admissions", "apply", "join", "enroll", "cet", "jee"],
        "hi": ["प्रवेश", "एडमिशन", "आवेदन", "दाखिला"],
        "mr": ["प्रवेश", "अॅडमिशन", "अर्ज", "नोंदणी"]
    },
    "placement": {
        "en": ["placement", "placements", "job", "company", "recruit", "salary", "package", "lpa"],
        "hi": ["प्लेसमेंट", "नौकरी", "जॉब", "कंपनी", "पैकेज"],
        "mr": ["प्लेसमेंट", "नोकरी", "जॉब", "कंपनी", "पॅकेज"]
    },
    "hostel": {
        "en": ["hostel", "hostels", "stay", "accommodation", "dormitory", "mess"],
        "hi": ["हॉस्टल", "छात्रावास", "रहना", "मेस"],
        "mr": ["वसतिगृह", "हॉस्टेल", "राहणे", "मेस"]
    },
    "contact": {
        "en": ["contact", "phone", "email", "address", "location", "website"],
        "hi": ["संपर्क", "फोन", "ईमेल", "पता", "वेबसाइट"],
        "mr": ["संपर्क", "फोन", "ईमेल", "पत्ता", "वेबसाइट"]
    },
    "facilities": {
        "en": ["facilit", "lab", "library", "wifi", "sports", "cafeteria", "bus", "campus"],
        "hi": ["सुविधा", "लैब", "लाइब्रेरी", "पुस्तकालय", "खेल", "बस", "परिसर"],
        "mr": ["सुविधा", "प्रयोगशाळा", "ग्रंथालय", "क्रीडा", "बस", "परिसर"]
    }
}

last_topic = None

def get_response(msg):
    global last_topic
    lang = detect_language(msg)
    msg_lower = msg.lower()

    def match(intent):
        return any(kw in msg_lower for kw in KEYWORDS[intent].get(lang, []) + KEYWORDS[intent].get("en", []))

    # Greetings
    if match("greeting"):
        greetings = {
            "en": ["Hello 👋! Welcome to PallottiBot. How can I help you?",
                   "Hi there 😊! Ask me anything about SVPCET.",
                   "Hey! I'm PallottiBot 🤖 — what would you like to know?"],
            "hi": ["नमस्ते 👋! PallottiBot में आपका स्वागत है। मैं आपकी कैसे मदद कर सकता हूँ?",
                   "हेलो 😊! SVPCET के बारे में कुछ भी पूछें।"],
            "mr": ["नमस्कार 👋! PallottiBot मध्ये आपले स्वागत आहे. मी आपली कशी मदत करू?",
                   "हॅलो 😊! SVPCET बद्दल काहीही विचारा।"]
        }
        return random.choice(greetings.get(lang, greetings["en"])), lang

    for intent in ["fees", "courses", "admission", "placement", "hostel", "contact", "facilities"]:
        if match(intent):
            last_topic = intent
            return knowledge[intent].get(lang, knowledge[intent]["en"]), lang

    # Hostel+fees context
    if match("hostel") and last_topic == "fees":
        resp = {"en": "🏠 Hostel fees are separate from academic fees.",
                "hi": "🏠 हॉस्टल शुल्क शैक्षणिक शुल्क से अलग है।",
                "mr": "🏠 वसतिगृह शुल्क शैक्षणिक शुल्काहून वेगळे आहे।"}
        return resp.get(lang, resp["en"]), lang

    if "thank" in msg_lower or "धन्यवाद" in msg or "आभार" in msg:
        resp = {"en": "You're welcome 😊! Let me know if you have more questions.",
                "hi": "आपका स्वागत है 😊! कोई और प्रश्न हो तो पूछें।",
                "mr": "आपले स्वागत आहे 😊! आणखी प्रश्न असल्यास विचारा।"}
        return resp.get(lang, resp["en"]), lang

    fallback = {
        "en": "🤖 I didn't understand that.\n\nYou can ask about:\n• Fees  • Courses  • Admission  • Placement  • Hostel  • Facilities  • Contact 😊",
        "hi": "🤖 मैं समझ नहीं पाया।\n\nआप पूछ सकते हैं:\n• फीस  • कोर्स  • प्रवेश  • प्लेसमेंट  • हॉस्टल  • सुविधाएं  • संपर्क 😊",
        "mr": "🤖 मला समजले नाही।\n\nआपण विचारू शकता:\n• फी  • अभ्यासक्रम  • प्रवेश  • प्लेसमेंट  • वसतिगृह  • सुविधा  • संपर्क 😊"
    }
    return fallback.get(lang, fallback["en"]), lang


# ════════════════════════════════════════════════════════
#  AUTH ROUTES
# ════════════════════════════════════════════════════════

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username  = data.get("username", "").strip()
    password  = data.get("password", "")
    full_name = data.get("full_name", data.get("name", username))
    email     = data.get("email", "")
    phone     = data.get("phone", "")
    dept      = data.get("department", "")
    year      = data.get("year", "")

    if not username or not password:
        return jsonify({"status": "error", "msg": "Username and password are required."})

    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO users (username, password, full_name, email, phone, department, year)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (username, password, full_name, email, phone, dept, year))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"status": "success"})
    except mysql.connector.IntegrityError:
        return jsonify({"status": "error", "msg": "Username already exists."})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})


@app.route("/login", methods=["POST"])
def login():
    data     = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    try:
        conn = get_db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM users WHERE username=%s AND password=%s", (username, password))
        user = cur.fetchone()
        cur.close(); conn.close()
        if user:
            return jsonify({"status": "success", "name": user["full_name"]})
        return jsonify({"status": "error", "msg": "Invalid credentials."})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})


# ════════════════════════════════════════════════════════
#  CHAT ROUTE  (saves to DB)
# ════════════════════════════════════════════════════════

@app.route("/chat", methods=["POST"])
def chat():
    data     = request.get_json()
    user_msg = data.get("message", "")
    username = data.get("username", "guest")

    reply, lang = get_response(user_msg)

    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("INSERT INTO chat_history (username, role, message, language) VALUES (%s, 'user', %s, %s)",
                    (username, user_msg, lang))
        cur.execute("INSERT INTO chat_history (username, role, message, language) VALUES (%s, 'bot', %s, %s)",
                    (username, reply, lang))
        conn.commit()
        cur.close(); conn.close()
    except Exception as e:
        print(f"Chat save error: {e}")

    return jsonify({"reply": reply, "language": lang})


# ════════════════════════════════════════════════════════
#  CHAT RECOVERY  (load previous chats)
# ════════════════════════════════════════════════════════

@app.route("/chat/history", methods=["GET"])
def chat_history():
    username = request.args.get("username", "")
    if not username:
        return jsonify({"status": "error", "msg": "Username required."})

    try:
        conn = get_db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT role, message, language, created_at
            FROM chat_history
            WHERE username = %s
            ORDER BY created_at ASC
            LIMIT 100
        """, (username,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        # Convert datetime to string
        for r in rows:
            r["created_at"] = r["created_at"].strftime("%Y-%m-%d %H:%M:%S")
        return jsonify({"status": "success", "history": rows})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})


# ════════════════════════════════════════════════════════
#  DELETE CHAT  (clear all messages for a user)
# ════════════════════════════════════════════════════════

@app.route("/chat/delete", methods=["POST"])
def delete_chat():
    data     = request.get_json()
    username = data.get("username", "")

    if not username:
        return jsonify({"status": "error", "msg": "Username required."})

    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("DELETE FROM chat_history WHERE username = %s", (username,))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"status": "success", "msg": "Chat history deleted."})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})


# ════════════════════════════════════════════════════════
#  STUDENT INFO ROUTES
# ════════════════════════════════════════════════════════

@app.route("/student", methods=["GET"])
def get_student():
    """Lookup a student by roll_no or username"""
    roll   = request.args.get("roll_no", "")
    uname  = request.args.get("username", "")

    try:
        conn = get_db()
        cur  = conn.cursor(dictionary=True)
        if roll:
            cur.execute("SELECT * FROM students WHERE roll_no = %s", (roll,))
        elif uname:
            cur.execute("SELECT * FROM students WHERE email LIKE %s", (f"%{uname}%",))
        else:
            cur.close(); conn.close()
            return jsonify({"status": "error", "msg": "Provide roll_no or username."})

        student = cur.fetchone()
        cur.close(); conn.close()

        if student:
            student["created_at"] = student["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            return jsonify({"status": "success", "student": student})
        return jsonify({"status": "error", "msg": "Student not found."})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})


@app.route("/student/add", methods=["POST"])
def add_student():
    """Add or update student record"""
    data = request.get_json()
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO students (roll_no, full_name, email, phone, department, year, cgpa, fees_paid)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                full_name  = VALUES(full_name),
                email      = VALUES(email),
                phone      = VALUES(phone),
                department = VALUES(department),
                year       = VALUES(year),
                cgpa       = VALUES(cgpa),
                fees_paid  = VALUES(fees_paid)
        """, (
            data.get("roll_no"), data.get("full_name"), data.get("email"),
            data.get("phone"), data.get("department"), data.get("year"),
            data.get("cgpa"), data.get("fees_paid", False)
        ))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})


# ════════════════════════════════════════════════════════
#  STATIC FILE SERVING
# ════════════════════════════════════════════════════════

@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)


# ════════════════════════════════════════════════════════
#  RUN
# ════════════════════════════════════════════════════════

if __name__ == "__main__":
    app.run(debug=True)
