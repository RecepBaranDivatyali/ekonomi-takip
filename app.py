import streamlit as st
import sqlite3
import pandas as pd
import math
from datetime import datetime, timedelta
import os
import requests

# Database configuration
DB_PATH = 'ekonomi.db'

# Supabase configuration (optional fallback to SQLite)
SUPABASE_URL = st.secrets.get("SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = st.secrets.get("SUPABASE_KEY") or os.environ.get("SUPABASE_KEY")
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_KEY)

class SupabaseClient:
    def __init__(self, url, key):
        self.url = url.rstrip('/')
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        
    def _get(self, table, params=None):
        r = requests.get(f"{self.url}/rest/v1/{table}", headers=self.headers, params=params)
        r.raise_for_status()
        return r.json()
        
    def _insert(self, table, data):
        r = requests.post(f"{self.url}/rest/v1/{table}", headers=self.headers, json=data)
        r.raise_for_status()
        return r.json()
        
    def _update(self, table, data, id_val):
        r = requests.patch(f"{self.url}/rest/v1/{table}?id=eq.{id_val}", headers=self.headers, json=data)
        r.raise_for_status()
        return r.json()
        
    def _delete(self, table, id_val):
        r = requests.delete(f"{self.url}/rest/v1/{table}?id=eq.{id_val}", headers=self.headers)
        r.raise_for_status()
        return r.json()

# --- DATABASE OPERATIONS ---

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        try:
            logs = client._get("interest_rate_logs", params={"select": "id"})
            if not logs:
                client._insert("interest_rate_logs", {"date": "2026-01-01", "rate": 0.41})
        except Exception:
            # Let the user run the SQL schema in their Supabase console first
            pass
    else:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 1. Categories Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            emoji TEXT NOT NULL,
            color TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('Gelir', 'Gider'))
        )
        """)
        
        # 2. Transactions Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            category_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            time_range TEXT NOT NULL DEFAULT '05:00 - 18:15',
            debt_id INTEGER,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
            FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
        )
        """)
        
        # 3. Debts Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS debts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK(type IN ('Alınacak', 'Verilecek')),
            amount REAL NOT NULL,
            name TEXT NOT NULL,
            due_date TEXT,
            status TEXT NOT NULL CHECK(status IN ('Bekliyor', 'Ödendi')),
            category_id INTEGER,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
        """)
        
        # Migration safety for existing databases
        cursor.execute("PRAGMA table_info(transactions)")
        cols_tx = [row['name'] for row in cursor.fetchall()]
        if 'time_range' not in cols_tx:
            cursor.execute("ALTER TABLE transactions ADD COLUMN time_range TEXT NOT NULL DEFAULT '05:00 - 18:15'")
        if 'debt_id' not in cols_tx:
            cursor.execute("ALTER TABLE transactions ADD COLUMN debt_id INTEGER REFERENCES debts(id) ON DELETE CASCADE")
            
        cursor.execute("PRAGMA table_info(debts)")
        cols_debt = [row['name'] for row in cursor.fetchall()]
        if 'category_id' not in cols_debt:
            cursor.execute("ALTER TABLE debts ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL")
        
        # 4. Interest Rate Logs Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS interest_rate_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            rate REAL NOT NULL
        )
        """)
        
        # Seed default interest rate of 41% if database is newly created
        cursor.execute("SELECT COUNT(*) as count FROM interest_rate_logs")
        if cursor.fetchone()['count'] == 0:
            cursor.execute("INSERT INTO interest_rate_logs (date, rate) VALUES (?, ?)", ('2026-01-01', 0.41))
            
        conn.commit()
        conn.close()

# Category CRUD
def add_category(name, emoji, color, type_val):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        client._insert("categories", {"name": name, "emoji": emoji, "color": color, "type": type_val})
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO categories (name, emoji, color, type) VALUES (?, ?, ?, ?)",
            (name, emoji, color, type_val)
        )
        conn.commit()
        conn.close()

def delete_category(category_id):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        client._delete("categories", category_id)
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM categories WHERE id = ?", (category_id,))
        conn.commit()
        conn.close()

def update_category(category_id, name, emoji, color, type_val):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        client._update("categories", {"name": name, "emoji": emoji, "color": color, "type": type_val}, category_id)
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE categories
            SET name = ?, emoji = ?, color = ?, type = ?
            WHERE id = ?
        """, (name, emoji, color, type_val, category_id))
        conn.commit()
        conn.close()

def get_categories():
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        return client._get("categories", params={"select": "*", "order": "name.asc"})
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, emoji, color, type FROM categories ORDER BY name ASC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

# Transaction CRUD
def add_transaction(date_str, category_id, amount, description, time_range='05:00 - 18:15'):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        client._insert("transactions", {
            "date": date_str,
            "category_id": category_id,
            "amount": amount,
            "description": description,
            "time_range": time_range
        })
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO transactions (date, category_id, amount, description, time_range) VALUES (?, ?, ?, ?, ?)",
            (date_str, category_id, amount, description, time_range)
        )
        conn.commit()
        conn.close()

def delete_transaction(transaction_id):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        client._delete("transactions", transaction_id)
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        conn.commit()
        conn.close()

def update_transaction(transaction_id, date_str, category_id, amount, description, time_range):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        client._update("transactions", {
            "date": date_str,
            "category_id": category_id,
            "amount": amount,
            "description": description,
            "time_range": time_range
        }, transaction_id)
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE transactions
            SET date = ?, category_id = ?, amount = ?, description = ?, time_range = ?
            WHERE id = ?
        """, (date_str, category_id, amount, description, time_range, transaction_id))
        conn.commit()
        conn.close()

def get_transactions(limit=None):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        params = {
            "select": "id,date,category_id,amount,description,time_range,categories(name,emoji,color,type)",
            "order": "date.desc,id.desc"
        }
        if limit:
            params["limit"] = limit
        data = client._get("transactions", params=params)
        res = []
        for row in data:
            item = {
                "id": row["id"],
                "date": row["date"],
                "category_id": row["category_id"],
                "amount": row["amount"],
                "description": row["description"],
                "time_range": row["time_range"],
            }
            cat = row.get("categories")
            if cat:
                item["category_name"] = cat["name"]
                item["emoji"] = cat["emoji"]
                item["color"] = cat["color"]
                item["type"] = cat["type"]
            else:
                item["category_name"] = None
                item["emoji"] = None
                item["color"] = None
                item["type"] = None
            res.append(item)
        return res
    else:
        conn = get_connection()
        cursor = conn.cursor()
        query = """
            SELECT t.id, t.date, t.category_id, t.amount, t.description, t.time_range, c.name as category_name, c.emoji, c.color, c.type
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            ORDER BY t.date DESC, t.id DESC
        """
        if limit:
            query += f" LIMIT {limit}"
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

# Debt CRUD
def add_debt(type_val, amount, name, due_date, status, category_id=None):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        client._insert("debts", {
            "type": type_val,
            "amount": amount,
            "name": name,
            "due_date": due_date,
            "status": status,
            "category_id": category_id
        })
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO debts (type, amount, name, due_date, status, category_id) VALUES (?, ?, ?, ?, ?, ?)",
            (type_val, amount, name, due_date, status, category_id)
        )
        conn.commit()
        conn.close()

def delete_debt(debt_id):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        client._delete("debts", debt_id)
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM debts WHERE id = ?", (debt_id,))
        conn.commit()
        conn.close()

def update_debt_status(debt_id, status):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        client._update("debts", {"status": status}, debt_id)
        if status == 'Ödendi':
            debts = client._get("debts", params={"id": f"eq.{debt_id}"})
            if debts:
                debt = debts[0]
                if debt['category_id']:
                    tx_desc = f"{debt['name']} (Borç Kapatma)"
                    today_str = datetime.now().strftime('%Y-%m-%d')
                    client._insert("transactions", {
                        "date": today_str,
                        "category_id": debt['category_id'],
                        "amount": debt['amount'],
                        "description": tx_desc,
                        "time_range": '05:00 - 18:15',
                        "debt_id": debt_id
                    })
        else:
            requests.delete(f"{client.url}/rest/v1/transactions?debt_id=eq.{debt_id}", headers=client.headers)
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE debts SET status = ? WHERE id = ?", (status, debt_id))
        
        if status == 'Ödendi':
            cursor.execute("SELECT type, amount, name, category_id, due_date FROM debts WHERE id = ?", (debt_id,))
            debt = cursor.fetchone()
            if debt and debt['category_id']:
                tx_desc = f"{debt['name']} (Borç Kapatma)"
                today_str = datetime.now().strftime('%Y-%m-%d')
                cursor.execute("""
                    INSERT INTO transactions (date, category_id, amount, description, time_range, debt_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (today_str, debt['category_id'], debt['amount'], tx_desc, '05:00 - 18:15', debt_id))
        else:
            cursor.execute("DELETE FROM transactions WHERE debt_id = ?", (debt_id,))
            
        conn.commit()
        conn.close()

def update_debt(debt_id, type_val, amount, name, due_date, status, category_id=None):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        debts = client._get("debts", params={"id": f"eq.{debt_id}"})
        old_status = debts[0]['status'] if debts else 'Bekliyor'
        
        client._update("debts", {
            "type": type_val,
            "amount": amount,
            "name": name,
            "due_date": due_date,
            "status": status,
            "category_id": category_id
        }, debt_id)
        
        if status == 'Ödendi':
            if old_status == 'Bekliyor':
                tx_desc = f"{name} (Borç Kapatma)"
                today_str = datetime.now().strftime('%Y-%m-%d')
                client._insert("transactions", {
                    "date": today_str,
                    "category_id": category_id,
                    "amount": amount,
                    "description": tx_desc,
                    "time_range": '05:00 - 18:15',
                    "debt_id": debt_id
                })
            else:
                tx_desc = f"{name} (Borç Kapatma)"
                requests.patch(f"{client.url}/rest/v1/transactions?debt_id=eq.{debt_id}", headers=client.headers, json={
                    "category_id": category_id,
                    "amount": amount,
                    "description": tx_desc
                })
        else:
            requests.delete(f"{client.url}/rest/v1/transactions?debt_id=eq.{debt_id}", headers=client.headers)
    else:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT status FROM debts WHERE id = ?", (debt_id,))
        row = cursor.fetchone()
        old_status = row['status'] if row else 'Bekliyor'
        
        cursor.execute("""
            UPDATE debts
            SET type = ?, amount = ?, name = ?, due_date = ?, status = ?, category_id = ?
            WHERE id = ?
        """, (type_val, amount, name, due_date, status, category_id, debt_id))
        
        if status == 'Ödendi':
            if old_status == 'Bekliyor':
                tx_desc = f"{name} (Borç Kapatma)"
                today_str = datetime.now().strftime('%Y-%m-%d')
                cursor.execute("""
                    INSERT INTO transactions (date, category_id, amount, description, time_range, debt_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (today_str, category_id, amount, tx_desc, '05:00 - 18:15', debt_id))
            else:
                tx_desc = f"{name} (Borç Kapatma)"
                cursor.execute("""
                    UPDATE transactions
                    SET category_id = ?, amount = ?, description = ?
                    WHERE debt_id = ?
                """, (category_id, amount, tx_desc, debt_id))
        else:
            cursor.execute("DELETE FROM transactions WHERE debt_id = ?", (debt_id,))
            
        conn.commit()
        conn.close()

def get_debts():
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        data = client._get("debts", params={
            "select": "id,type,amount,name,due_date,status,category_id,categories(name,emoji,color)",
            "order": "due_date.asc,id.desc"
        })
        res = []
        for row in data:
            item = {
                "id": row["id"],
                "type": row["type"],
                "amount": row["amount"],
                "name": row["name"],
                "due_date": row["due_date"],
                "status": row["status"],
                "category_id": row["category_id"],
            }
            cat = row.get("categories")
            if cat:
                item["category_name"] = cat["name"]
                item["category_emoji"] = cat["emoji"]
                item["category_color"] = cat["color"]
            else:
                item["category_name"] = None
                item["category_emoji"] = None
                item["category_color"] = None
            res.append(item)
        return res
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.id, d.type, d.amount, d.name, d.due_date, d.status, d.category_id,
                   c.name as category_name, c.emoji as category_emoji, c.color as category_color
            FROM debts d
            LEFT JOIN categories c ON d.category_id = c.id
            ORDER BY d.due_date ASC, d.id DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

# Interest Rate CRUD
def add_or_update_rate_log(date_str, rate):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        logs = client._get("interest_rate_logs", params={"date": f"eq.{date_str}"})
        if logs:
            client._update("interest_rate_logs", {"rate": rate}, logs[0]['id'])
        else:
            client._insert("interest_rate_logs", {"date": date_str, "rate": rate})
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO interest_rate_logs (date, rate)
            VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET rate=excluded.rate
        """, (date_str, rate))
        conn.commit()
        conn.close()

def delete_rate_log(log_id):
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        logs = client._get("interest_rate_logs", params={"select": "id"})
        if len(logs) > 1:
            client._delete("interest_rate_logs", log_id)
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM interest_rate_logs")
        if cursor.fetchone()['count'] > 1:
            cursor.execute("DELETE FROM interest_rate_logs WHERE id = ?", (log_id,))
        conn.commit()
        conn.close()

def get_rate_logs():
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        return client._get("interest_rate_logs", params={"select": "id,date,rate", "order": "date.desc"})
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, date, rate FROM interest_rate_logs ORDER BY date DESC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]


# --- BİLEŞİK FAİZ VE ZAMAN SİMÜLASYON MOTORU (Ledger Engine) ---

def get_on_account_details(balance, active_rate):
    """
    Burgan Bank ON Hesap faiz kurallarına göre vadesiz bakiye limitini,
    uygulanan faiz oranını ve faiz işleyip işlemeyeceğini döner.
    """
    if balance < 10500.0:
        return balance, 0.0, False
        
    if balance < 50000.0:
        vadesiz = 10000.0
        rate = 0.41 if active_rate == 0.41 else 0.45
    elif balance < 100000.0:
        vadesiz = 12500.0
        rate = 0.41 if active_rate == 0.41 else 0.45
    elif balance < 250000.0:
        vadesiz = 25000.0
        rate = 0.41 if active_rate == 0.41 else 0.45
    elif balance < 500000.0:
        vadesiz = 50000.0
        rate = 0.41 if active_rate == 0.41 else 0.45
    elif balance < 750000.0:
        vadesiz = 90000.0
        rate = 0.41 if active_rate == 0.41 else 0.45
    elif balance < 1000000.0:
        vadesiz = 140000.0
        rate = 0.41 if active_rate == 0.41 else 0.45
    elif balance < 1250000.0:
        vadesiz = 165000.0
        rate = 0.40 if active_rate == 0.41 else 0.45
    else:
        vadesiz = 175000.0
        rate = 0.40 if active_rate == 0.41 else 0.45
        
    return vadesiz, rate, True

def run_simulation(until_date=None):
    if until_date is None:
        until_date = datetime.now().date()
        
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        # Fetch categories
        cat_data = client._get("categories", params={"select": "id,name,emoji,color,type"})
        categories = {row['id']: row for row in cat_data}
        
        # Fetch transactions
        tx_data = client._get("transactions", params={"select": "id,date,category_id,amount,description", "order": "date.asc,id.asc"})
        tx_list = tx_data
        
        # Fetch rate logs
        rate_data = client._get("interest_rate_logs", params={"select": "date,rate", "order": "date.asc"})
        rate_logs = rate_data
    else:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Fetch categories
        cursor.execute("SELECT id, name, emoji, color, type FROM categories")
        categories = {row['id']: dict(row) for row in cursor.fetchall()}
        
        # Fetch transactions
        cursor.execute("""
            SELECT id, date, category_id, amount, description
            FROM transactions
            ORDER BY date ASC, id ASC
        """)
        tx_list = [dict(row) for row in cursor.fetchall()]
        
        # Fetch rate logs
        cursor.execute("SELECT date, rate FROM interest_rate_logs ORDER BY date ASC")
        rate_logs = [dict(row) for row in cursor.fetchall()]
        conn.close()
    
    # Group transactions by date
    tx_by_date = {}
    for tx in tx_list:
        cat = categories.get(tx['category_id'])
        if not cat:
            continue
        tx['cat_type'] = cat['type']
        tx['cat_name'] = cat['name']
        tx['emoji'] = cat['emoji']
        tx['color'] = cat['color']
        
        dt = datetime.strptime(tx['date'], '%Y-%m-%d').date()
        tx_by_date.setdefault(dt, []).append(tx)
        
    # Map rate logs by date
    rate_by_date = {}
    for log in rate_logs:
        dt = datetime.strptime(log['date'], '%Y-%m-%d').date()
        rate_by_date[dt] = log['rate']
        
    # Determine start date
    dates = []
    if tx_by_date:
        dates.append(min(tx_by_date.keys()))
    if rate_by_date:
        dates.append(min(rate_by_date.keys()))
        
    if not dates:
        return 0.0, 0.0, [], 0.0
        
    start_date = min(dates)
    if start_date > until_date:
        start_date = until_date
        
    current_vault = 0.0
    total_interest_earned = 0.0
    accumulated_gross = 0.0
    daily_log = []
    
    # Initialize active rate
    active_rate = 0.41
    past_rates = [log for log in rate_logs if datetime.strptime(log['date'], '%Y-%m-%d').date() <= start_date]
    if past_rates:
        active_rate = past_rates[-1]['rate']
        
    curr = start_date
    delta = timedelta(days=1)
    
    # Locked Friday/Last Business Day state for weekends
    locked_vadesiz_limit = 0.0
    locked_rate_today = 0.0
    locked_qualifies = False
    locked_gross_raw = 0.0
    
    # Day by day simulation
    while curr <= until_date:
        if curr in rate_by_date:
            active_rate = rate_by_date[curr]
            
        day_income = 0.0
        day_expense = 0.0
        is_weekend = curr.weekday() >= 5  # 5: Saturday, 6: Sunday
        
        # 1. Morning Posting (05:00) on Business Days
        posted_interest = 0.0
        vault_before_posting = current_vault
        if not is_weekend and accumulated_gross > 0.0:
            posted_gross = math.floor(accumulated_gross * 100) / 100
            posted_stopaj = math.floor(posted_gross * 0.175 * 100) / 100
            posted_interest = math.floor((posted_gross - posted_stopaj) * 100) / 100
            current_vault += posted_interest
            total_interest_earned += posted_interest
            accumulated_gross = 0.0
            
        # 2. Process all transactions of the day
        if curr in tx_by_date:
            for tx in tx_by_date[curr]:
                if tx['cat_type'] == 'Gelir':
                    current_vault += tx['amount']
                    day_income += tx['amount']
                else:
                    current_vault -= tx['amount']
                    day_expense += tx['amount']
                    
        # 3. Evening Evaluation (18:15)
        if not is_weekend:
            # Business day: evaluate current vault and lock today's interest
            vadesiz_limit, rate_today, qualifies = get_on_account_details(current_vault, active_rate)
            if qualifies:
                earning_base = max(0.0, current_vault - vadesiz_limit)
                gross_raw = earning_base * (rate_today / 365.0)
                gross_truncated = math.floor(gross_raw * 100) / 100
                stopaj_truncated = math.floor(gross_truncated * 0.175 * 100) / 100
                daily_interest = math.floor((gross_truncated - stopaj_truncated) * 100) / 100
            else:
                vadesiz_limit = current_vault
                earning_base = 0.0
                gross_raw = 0.0
                daily_interest = 0.0
                rate_today = 0.0
                
            # Lock this state for the weekend
            locked_vadesiz_limit = vadesiz_limit
            locked_rate_today = rate_today
            locked_qualifies = qualifies
            locked_gross_raw = gross_raw
        else:
            # Weekend day: Use Friday's locked state to calculate today's interest
            vadesiz_limit = locked_vadesiz_limit
            rate_today = locked_rate_today
            qualifies = locked_qualifies
            gross_raw = locked_gross_raw
            
            if qualifies:
                earning_base = max(0.0, current_vault - vadesiz_limit)
                gross_truncated = math.floor(gross_raw * 100) / 100
                stopaj_truncated = math.floor(gross_truncated * 0.175 * 100) / 100
                daily_interest = math.floor((gross_truncated - stopaj_truncated) * 100) / 100
            else:
                earning_base = 0.0
                daily_interest = 0.0
                
        # Accumulate this day's gross interest
        accumulated_gross += gross_raw
        
        daily_log.append({
            'date': curr.strftime('%Y-%m-%d'),
            'vault_before_interest': vault_before_posting, # vault at start of day
            'vault_after_interest': current_vault, # vault after morning posting + txs
            'interest_earned': daily_interest, # interest calculated today
            'posted_interest': posted_interest, # interest posted today
            'rate': rate_today,
            'vadesiz_limit': vadesiz_limit,
            'earning_base': earning_base,
            'income': day_income,
            'expense': day_expense
        })
        
        curr += delta
        
    # Pending interest calculation
    pending_net = 0.0
    if accumulated_gross > 0.0:
        pending_gross = math.floor(accumulated_gross * 100) / 100
        pending_stopaj = math.floor(pending_gross * 0.175 * 100) / 100
        pending_net = math.floor((pending_gross - pending_stopaj) * 100) / 100
        
    # Ensure values are rounded to 2 decimal places
    current_vault = round(current_vault, 2)
    total_interest_earned = round(total_interest_earned, 2)
    if daily_log:
        daily_log[-1]['vault_after_interest'] = round(daily_log[-1]['vault_after_interest'], 2)
        
    return current_vault, total_interest_earned, daily_log, pending_net


def get_monthly_flow():
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        current_month = datetime.now().strftime('%Y-%m')
        data = client._get("transactions", params={
            "date": f"like.{current_month}%",
            "select": "amount,categories(type)"
        })
        stats = {'Gelir': 0.0, 'Gider': 0.0}
        for row in data:
            cat = row.get("categories")
            if cat and cat["type"] in stats:
                stats[cat["type"]] += row["amount"]
        return stats
    else:
        current_month = datetime.now().strftime('%Y-%m')
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.type, SUM(t.amount) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.date LIKE ?
            GROUP BY c.type
        """, (f"{current_month}%",))
        rows = cursor.fetchall()
        conn.close()
        
        stats = {'Gelir': 0.0, 'Gider': 0.0}
        for row in rows:
            stats[row['type']] = row['total']
        return stats


def get_pending_debts_totals():
    if USE_SUPABASE:
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        data = client._get("debts", params={
            "status": "eq.Bekliyor",
            "select": "type,amount"
        })
        totals = {'Alınacak': 0.0, 'Verilecek': 0.0}
        for row in data:
            t_type = row.get("type")
            if t_type in totals:
                totals[t_type] += row["amount"]
        return totals
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT type, SUM(amount) as total
            FROM debts
            WHERE status = 'Bekliyor'
            GROUP BY type
        """)
        rows = cursor.fetchall()
        conn.close()
        
        totals = {'Alınacak': 0.0, 'Verilecek': 0.0}
        for row in rows:
            totals[row['type']] = row['total']
        return totals


# --- UI HELPERS ---

def get_category_badge_html(emoji, name, color):
    return f"<span class='category-badge' style='background-color: {color}15; color: {color}; padding: 4px 10px; border-radius: 8px; font-weight: 600; font-size: 0.78rem; border: 1px solid {color}30; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;'><span style='font-size: 0.82rem; line-height: 1;'>{emoji}</span><span>{name}</span></span>"

def render_tx_row_html(tx, sign, amt_color, extra_style=""):
    badge = get_category_badge_html(tx['emoji'], tx['category_name'], tx['color'])
    desc = tx['description'] or ''
    amount_str = f"{sign} {tx['amount']:,.2f} TL"
    time_suffix = f" ({tx['time_range']})" if 'time_range' in tx else ""
    date_str = f"{tx['date']}{time_suffix}"
    return f'<div class="tx-feed-item" style="{extra_style}"><div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; min-width: 0;"><div style="display: flex; align-items: center; gap: 8px; min-width: 0;">{badge}<div style="font-weight: 500; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="{desc}">{desc}</div></div><div style="text-align: right; flex-shrink: 0;"><div style="color: {amt_color}; font-weight: 700; font-size: 0.92rem;">{amount_str}</div><div style="font-size: 0.7rem; color: #94A3B8; margin-top: 2px;">{date_str}</div></div></div></div>'

def get_debt_badge_html(due_date_str):
    if not due_date_str:
        return ""
    try:
        due = datetime.strptime(due_date_str, '%Y-%m-%d').date()
        today = datetime.now().date()
        diff = (due - today).days
        
        if diff > 7:
            color = "#64748B"
            bg = "rgba(100, 116, 139, 0.08)"
            border = "rgba(100, 116, 139, 0.15)"
            text = f"📅 {diff} gün kaldı"
        elif diff > 0:
            color = "#D97706"
            bg = "rgba(217, 119, 6, 0.08)"
            border = "rgba(217, 119, 6, 0.15)"
            text = f"⏳ {diff} gün kaldı"
        elif diff == 0:
            color = "#EF4444"
            bg = "rgba(239, 68, 68, 0.1)"
            border = "rgba(239, 68, 68, 0.25)"
            text = "🚨 Bugün son gün!"
        else:
            color = "#EF4444"
            bg = "rgba(239, 68, 68, 0.12)"
            border = "rgba(239, 68, 68, 0.3)"
            text = f"🔴 {abs(diff)} gün gecikti ❗️"
            
        return f"<span style='background-color: {bg}; color: {color}; padding: 4px 10px; border-radius: 8px; font-weight: 600; font-size: 0.78rem; border: 1px solid {border}; margin-left: 10px; display: inline-flex; align-items: center;'>{text}</span>"
    except Exception:
        return ""

def inject_custom_css():
    st.markdown("""
    <style>
    /* Google Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&display=swap');
    
    html, body, [class*="css"], .stApp {
        font-family: 'Plus Jakarta Sans', 'Outfit', 'Inter', sans-serif;
        font-size: 0.88rem !important;
        overflow-x: hidden !important;
        max-width: 100vw !important;
    }
    
    /* Typography Overrides */
    h1 {
        font-size: 1.85rem !important;
    }
    h2 {
        font-size: 1.45rem !important;
    }
    h3 {
        font-size: 1.15rem !important;
    }
    
    /* Hide top header bar to maximize clean feeling */
    header[data-testid="stHeader"] {
        background: transparent;
    }
    
    /* Spendee Metric Cards styling */
    .metric-card {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 16px;
        padding: 16px 20px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.01);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
        text-align: center;
    }
    
    .metric-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 20px -8px rgba(0, 0, 0, 0.08);
    }
    
    .metric-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 5px;
        background: linear-gradient(90deg, #3B82F6, #10B981);
    }
    
    .metric-card.gider::before {
        background: linear-gradient(90deg, #EF4444, #F59E0B);
    }
    
    .metric-card.faiz::before {
        background: linear-gradient(90deg, #8B5CF6, #EC4899);
    }
 
    .metric-title {
        font-size: 0.72rem;
        font-weight: 700;
        color: #64748B;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        margin-bottom: 6px;
    }
    
    .metric-value {
        font-size: 1.45rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        color: #1E293B;
    }
    
    .metric-sub {
        font-size: 0.7rem;
        color: #94A3B8;
        margin-top: 4px;
        font-weight: 500;
    }
    
    /* Transaction feed card layout */
    .tx-feed-item {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 10px 14px;
        margin-bottom: 8px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.01);
    }
    
    .tx-feed-item:hover {
        background: #F8FAFC;
        border-color: #CBD5E1;
    }
    
    /* Balance Header Grid layout */
    .balance-header-grid {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
        margin-bottom: 12px;
    }
    .balance-main {
        font-size: 2.6rem;
        font-weight: 850;
        letter-spacing: -1px;
        background: linear-gradient(135deg, #3B82F6, #10B981);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 2px 8px rgba(59, 130, 246, 0.1));
        padding: 0 10px;
    }
    .balance-badge {
        font-size: 1.15rem;
        font-weight: 700;
        padding: 6px 12px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
    }
    .badge-payable {
        color: #EF4444;
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.15);
    }
    .badge-receivable {
        color: #10B981;
        background: rgba(16, 185, 129, 0.08);
        border: 1px solid rgba(16, 185, 129, 0.15);
    }
    
    /* Dark Mode support */
    @media (prefers-color-scheme: dark) {
        .metric-card {
            background: #1E293B;
            border-color: #334155;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
        }
        .metric-value {
            color: #F8FAFC;
        }
        .metric-title {
            color: #94A3B8;
        }
        .tx-feed-item {
            background: #1E293B;
            border-color: #334155;
        }
        .tx-feed-item:hover {
            background: #2D3748;
            border-color: #4A5568;
        }
    }
    
    /* Align all horizontal blocks to center by default (for micro-rows like transaction lists) */
    div[data-testid="stHorizontalBlock"] {
        align-items: center !important;
        gap: 8px !important;
    }
    div[data-testid="stHorizontalBlock"] > div {
        padding: 0 !important;
    }
    
    /* Top-align main dashboard grid (containing charts), forms, and layouts */
    div[data-testid="stHorizontalBlock"]:has(div[data-testid="stArrowVegaLiteChart"]),
    div[data-testid="stHorizontalBlock"]:has(div[class*="stVegaLiteChart"]),
    div[data-testid="stHorizontalBlock"]:has(h1),
    div[data-testid="stHorizontalBlock"]:has(h2),
    div[data-testid="stHorizontalBlock"]:has(h3),
    div[data-testid="stHorizontalBlock"]:has(label),
    div[data-testid="stHorizontalBlock"]:has(div[data-testid="stWidgetLabel"]) {
        align-items: flex-start !important;
        gap: 16px !important;
    }
    
    /* Pretty forms and buttons */
    .stButton>button {
        border-radius: 10px;
        padding: 6px 12px;
        font-weight: 600;
        font-size: 0.8rem !important;
    }
    .stTextInput>div>div>input, .stSelectbox>div>div>div, .stNumberInput>div>div>input, .stDateInput>div>div>input {
        border-radius: 10px !important;
        font-size: 0.82rem !important;
        height: 36px !important;
    }
    label, div[data-testid="stWidgetLabel"] p {
        font-size: 0.78rem !important;
        font-weight: 600 !important;
    }
    
    /* Target only action buttons inside transaction rows, category lists, or debt actions */
    div[data-testid="stHorizontalBlock"]:has(.tx-card-marker) > div[data-testid="stColumn"]:has(.tx-actions-marker) div[data-testid="stButton"] > button,
    div[data-testid="stHorizontalBlock"]:has(.cat-row-marker) > div[data-testid="stColumn"]:has(.cat-actions-marker) div[data-testid="stButton"] > button,
    div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] > div[data-testid="element-container"] span.debt-btn-row) div[data-testid="stButton"] > button {
        padding: 2px 4px !important;
        min-width: 36px !important;
        min-height: 36px !important;
        width: 36px !important;
        height: 36px !important;
        border-radius: 50% !important; /* Circle buttons */
        font-size: 0.9rem !important;
        line-height: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        background-color: #F8FAFC !important;
        border: 1px solid #E2E8F0 !important;
        box-shadow: none !important;
        color: inherit !important;
        transition: all 0.2s ease-in-out !important;
    }
    
    div[data-testid="stHorizontalBlock"]:has(.tx-card-marker) > div[data-testid="stColumn"]:has(.tx-actions-marker) div[data-testid="stButton"] > button:hover,
    div[data-testid="stHorizontalBlock"]:has(.cat-row-marker) > div[data-testid="stColumn"]:has(.cat-actions-marker) div[data-testid="stButton"] > button:hover,
    div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] > div[data-testid="element-container"] span.debt-btn-row) div[data-testid="stButton"] > button:hover {
        background-color: #F1F5F9 !important;
        border-color: #CBD5E1 !important;
        transform: scale(1.1) !important;
    }
    
    /* Debt action button row: precisely target the DIRECT parent stHorizontalBlock using deep-path :has() */
    /* This prevents matching ancestor containers that also contain .debt-btn-row deep inside */
    div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] > div[data-testid="element-container"] span.debt-btn-row) {
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        justify-content: flex-end !important; /* Compact actions aligned to the right */
        gap: 8px !important;
        width: 100% !important;
        margin-top: 4px !important;
        margin-bottom: 12px !important;
    }
    div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] > div[data-testid="element-container"] span.debt-btn-row) > div[data-testid="stColumn"] {
        width: 44px !important;
        min-width: 44px !important;
        max-width: 44px !important;
        flex-grow: 0 !important;
        flex-shrink: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
    }

    /* Accordion debt card container & overlay button styling */
    div[data-testid="stVerticalBlock"]:has(span.debt-wrapper-marker) {
        position: relative !important;
        gap: 0 !important;
    }
    
    div[data-testid="stVerticalBlock"]:has(span.debt-wrapper-marker) > div.element-container:has(span.debt-wrapper-marker) {
        display: none !important;
    }
    
    div[data-testid="stVerticalBlock"]:has(span.debt-wrapper-marker) > div.element-container:has(div.stButton),
    div[data-testid="stVerticalBlock"]:has(span.debt-wrapper-marker) > div.element-container:has(div.stButton) > div.stButton {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 10 !important;
        margin: 0 !important;
        padding: 0 !important;
    }
    
    div[data-testid="stVerticalBlock"]:has(span.debt-wrapper-marker) > div.element-container:has(div.stButton) button {
        width: 100% !important;
        height: 100% !important;
        background: transparent !important;
        border: none !important;
        color: transparent !important;
        cursor: pointer !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        outline: none !important;
    }
    
    div[data-testid="stVerticalBlock"]:has(span.debt-wrapper-marker) > div.element-container:has(div.stButton) button:hover,
    div[data-testid="stVerticalBlock"]:has(span.debt-wrapper-marker) > div.element-container:has(div.stButton) button:focus,
    div[data-testid="stVerticalBlock"]:has(span.debt-wrapper-marker) > div.element-container:has(div.stButton) button:active {
        background: transparent !important;
        border: none !important;
        color: transparent !important;
        box-shadow: none !important;
        outline: none !important;
    }
    
    /* Hover effects for the debt card when wrapper/button is hovered */
    .debt-info-card {
        transition: all 0.2s ease-in-out !important;
    }
    div[data-testid="stVerticalBlock"]:has(span.debt-wrapper-marker):hover .debt-info-card {
        border-color: #CBD5E1 !important;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05) !important;
    }
    
    @media (prefers-color-scheme: dark) {
        div[data-testid="stVerticalBlock"]:has(span.debt-wrapper-marker):hover .debt-info-card {
            border-color: #475569 !important;
            background-color: #1e293b1a !important; /* subtle dark highlight */
        }
    }
    
    @media (prefers-color-scheme: dark) {
        div[data-testid="stHorizontalBlock"]:has(.tx-card-marker) > div[data-testid="stColumn"]:has(.tx-actions-marker) div[data-testid="stButton"] > button,
        div[data-testid="stHorizontalBlock"]:has(.cat-row-marker) > div[data-testid="stColumn"]:has(.cat-actions-marker) div[data-testid="stButton"] > button,
        div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] > div[data-testid="element-container"] span.debt-btn-row) div[data-testid="stButton"] > button {
            background-color: #1E293B !important;
            border-color: #334155 !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.tx-card-marker) > div[data-testid="stColumn"]:has(.tx-actions-marker) div[data-testid="stButton"] > button:hover,
        div[data-testid="stHorizontalBlock"]:has(.cat-row-marker) > div[data-testid="stColumn"]:has(.cat-actions-marker) div[data-testid="stButton"] > button:hover,
        div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] > div[data-testid="stVerticalBlock"] > div[data-testid="element-container"] span.debt-btn-row) div[data-testid="stButton"] > button:hover {
            background-color: #334155 !important;
            border-color: #475569 !important;
        }
    }
    
    /* Style for Emoji Grid Buttons (WhatsApp style) */
    div[data-testid="stHorizontalBlock"]:has(.emoji-marker) {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: wrap !important;
        justify-content: flex-start !important;
        gap: 6px !important;
        width: 100% !important;
    }
    div[data-testid="stHorizontalBlock"]:has(.emoji-marker) > div[data-testid="stColumn"] {
        width: 38px !important;
        min-width: 38px !important;
        max-width: 38px !important;
        flex-grow: 0 !important;
        flex-shrink: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
    }
    div[data-testid="stHorizontalBlock"]:has(.emoji-marker) > div[data-testid="stColumn"] button {
        font-size: 1.25rem !important;
        padding: 0 !important;
        width: 38px !important;
        height: 38px !important;
        min-width: 38px !important;
        min-height: 38px !important;
        border-radius: 8px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background-color: #F1F5F9 !important;
        border: 1px solid #E2E8F0 !important;
        transition: all 0.2s ease-in-out !important;
    }
    div[data-testid="stHorizontalBlock"]:has(.emoji-marker) > div[data-testid="stColumn"] button:hover {
        background-color: #E2E8F0 !important;
        transform: scale(1.1) !important;
    }
    
    @media (prefers-color-scheme: dark) {
        div[data-testid="stHorizontalBlock"]:has(.emoji-marker) > div[data-testid="stColumn"] button {
            background-color: #334155 !important;
            border-color: #475569 !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.emoji-marker) > div[data-testid="stColumn"] button:hover {
            background-color: #475569 !important;
        }
    }
    
    /* Mobile-specific adjustments for native-app feel */
    @media (max-width: 768px) {
        /* Reduce side padding on mobile to maximize content width */
        div[data-testid="stAppViewBlockContainer"] {
            padding: 0.75rem 0.5rem !important;
        }
        
        /* Smaller font sizes on mobile */
        h1 {
            font-size: 1.45rem !important;
        }
        h2 {
            font-size: 1.2rem !important;
        }
        h3 {
            font-size: 1.0rem !important;
        }
        .metric-value {
            font-size: 1.25rem !important;
        }
        .metric-title {
            font-size: 0.65rem !important;
            letter-spacing: 0.8px;
        }
        
        /* Reduce spacing between stacked vertical columns */
        div[data-testid="stVerticalBlock"] {
            gap: 0.5rem !important;
        }
        
        /* Make selectbox options and form fields feel more tap-friendly */
        .stTextInput>div>div>input, .stSelectbox>div>div>div, .stNumberInput>div>div>input, .stDateInput>div>div>input {
            height: 40px !important; /* Slightly larger for easier finger tapping */
            font-size: 0.88rem !important;
        }
        
        /* Compact tab menu on mobile */
        button[data-baseweb="tab"] {
            padding: 6px 10px !important;
            font-size: 0.78rem !important;
        }
        
        /* Compact list items padding */
        .tx-feed-item {
            padding: 8px 10px !important;
        }
        
        /* Balance Header grid on mobile */
        .balance-header-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            grid-template-areas: 
                "main main"
                "payable receivable" !important;
            gap: 12px 16px !important;
            justify-items: center !important;
            align-items: center !important;
        }
        .balance-main {
            grid-area: main !important;
            font-size: 1.95rem !important;
            padding: 0 !important;
            line-height: 1.2 !important;
        }
        .balance-badge {
            font-size: 0.95rem !important;
            padding: 5px 10px !important;
            border-radius: 10px !important;
            width: fit-content !important;
        }
        .badge-payable {
            grid-area: payable !important;
            justify-self: end !important;
        }
        .badge-receivable {
            grid-area: receivable !important;
            justify-self: start !important;
        }

        /* Prevent horizontal overflow on mobile viewports */
        html, body, [data-testid="stAppViewBlockContainer"] {
            overflow-x: hidden !important;
            max-width: 100vw !important;
        }

        /* Metric cards vertical gap fix on mobile */
        .metric-card {
            margin-bottom: 16px !important;
        }

        /* Emoji selector grid on mobile: force it to stay in a compact flex grid */
        div[data-testid="stHorizontalBlock"]:has(.emoji-marker) {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            justify-content: flex-start !important;
            gap: 6px !important;
        }

        /* Metric cards row layout on mobile: keep in a single row */
        div[data-testid="stHorizontalBlock"]:has(.metric-marker):not(:has(div[data-testid="stHorizontalBlock"])) {
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: stretch !important;
            gap: 6px !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.metric-marker):not(:has(div[data-testid="stHorizontalBlock"])) > div[data-testid="stColumn"] {
            width: 33.333% !important;
            min-width: 0 !important;
            flex-grow: 1 !important;
            flex-shrink: 0 !important;
            margin: 0 !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.metric-marker):not(:has(div[data-testid="stHorizontalBlock"])) .metric-card {
            padding: 8px 10px !important;
            min-height: 90px !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.metric-marker):not(:has(div[data-testid="stHorizontalBlock"])) .metric-value {
            font-size: 1.05rem !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.metric-marker):not(:has(div[data-testid="stHorizontalBlock"])) .metric-title {
            font-size: 0.62rem !important;
            letter-spacing: 0px !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.metric-marker):not(:has(div[data-testid="stHorizontalBlock"])) .metric-sub {
            display: block !important;
            font-size: 0.58rem !important;
            line-height: 1.1 !important;
            margin-top: 4px !important;
        }

        /* Transaction list row layout on mobile */
        div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] .tx-card-marker):not(:has(div[data-testid="stHorizontalBlock"]:has(.tx-card-marker))) {
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            gap: 8px !important;
            max-width: 100% !important;
            width: 100% !important;
        }
        div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] .tx-card-marker):not(:has(div[data-testid="stHorizontalBlock"]:has(.tx-card-marker))) > div[data-testid="stColumn"]:has(.tx-card-marker) {
            flex-grow: 1 !important;
            flex-shrink: 1 !important;
            min-width: 0 !important;
            width: auto !important;
        }
        div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] .tx-card-marker):not(:has(div[data-testid="stHorizontalBlock"]:has(.tx-card-marker))) > div[data-testid="stColumn"]:has(.tx-actions-marker) {
            flex-grow: 0 !important;
            flex-shrink: 0 !important;
            width: auto !important;
        }
        
        /* Transaction list inner columns containing edit/delete buttons side-by-side on mobile */
        div[data-testid="stColumn"]:has(.tx-actions-marker) div[data-testid="stHorizontalBlock"] {
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            gap: 6px !important;
            width: 100% !important;
        }
        div[data-testid="stColumn"]:has(.tx-actions-marker) div[data-testid="stHorizontalBlock"] > div[data-testid="stColumn"] {
            width: auto !important;
            min-width: 38px !important;
            max-width: 38px !important;
            flex-grow: 0 !important;
            flex-shrink: 0 !important;
            margin: 0 !important;
        }

        .tx-feed-item {
            width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
        }

        .category-badge > span:last-child {
            max-width: 90px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            display: inline-block !important;
        }

        /* Category Management layout on mobile: stack Yeni Kategori Oluştur on top of Mevcut Kategoriler */
        div[data-testid="stHorizontalBlock"]:has(.cat-page-marker) {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 24px !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.cat-page-marker) > div[data-testid="stColumn"] {
            width: 100% !important;
        }

        /* Category list row layout on mobile */
        div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] .cat-row-marker):not(:has(div[data-testid="stHorizontalBlock"]:has(.cat-row-marker))) {
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            gap: 6px !important;
            max-width: 100% !important;
            width: 100% !important;
        }
        div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] .cat-row-marker):not(:has(div[data-testid="stHorizontalBlock"]:has(.cat-row-marker))) > div[data-testid="stColumn"] {
            width: auto !important;
            flex-grow: 0 !important;
            flex-shrink: 0 !important;
            margin: 0 !important;
        }
        div[data-testid="stHorizontalBlock"]:has(> div[data-testid="stColumn"] .cat-row-marker):not(:has(div[data-testid="stHorizontalBlock"]:has(.cat-row-marker))) > div[data-testid="stColumn"]:has(.cat-row-marker) {
            flex-grow: 1 !important;
            flex-shrink: 1 !important;
            min-width: 0 !important;
        }

        /* Debt summary row layout on mobile: keep side-by-side */
        div[data-testid="stHorizontalBlock"]:has(.debt-summary-marker) {
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            align-items: stretch !important;
            gap: 8px !important;
            width: 100% !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.debt-summary-marker) > div[data-testid="stColumn"] {
            width: 50% !important;
            min-width: 0 !important;
            flex-grow: 1 !important;
            flex-shrink: 0 !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.debt-summary-marker) .metric-card {
            padding: 8px 10px !important;
            min-height: 90px !important;
            margin-bottom: 0 !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.debt-summary-marker) .metric-value {
            font-size: 1.05rem !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.debt-summary-marker) .metric-title {
            font-size: 0.62rem !important;
            letter-spacing: 0px !important;
        }
        div[data-testid="stHorizontalBlock"]:has(.debt-summary-marker) .metric-sub {
            display: block !important;
            font-size: 0.58rem !important;
            line-height: 1.1 !important;
            margin-top: 4px !important;
        }
    }
    </style>
    """, unsafe_allow_html=True)

    # Dynamic JS injection for category coloring inside selectboxes
    try:
        rows = get_categories()
        cat_colors = {f"{row['emoji']} {row['name']}": row['color'] for row in rows}
    except Exception:
        cat_colors = {}
        
    import json
    colors_json = json.dumps(cat_colors)
    
    js_code = """
    <script>
    (function() {
        const categoryColors = """ + colors_json + """;
        
        function styleOptions() {
            let options = [];
            try {
                if (window.parent && window.parent.document) {
                    const parentOpts = window.parent.document.querySelectorAll('div[role="option"], li[role="option"], [data-baseweb="menu"] li, ul[role="listbox"] li, div[data-baseweb="popover"] li');
                    options = Array.from(parentOpts);
                }
            } catch(e) {}
            
            options.forEach(opt => {
                const rawText = opt.innerText || opt.textContent || "";
                const text = rawText.replace(/\\s+/g, ' ').trim();
                
                for (const key in categoryColors) {
                    const normKey = key.replace(/\\s+/g, ' ').trim();
                    if (text === normKey || text.includes(normKey) || (text.indexOf(normKey.split(' ')[1]) !== -1 && text.indexOf(normKey.split(' ')[0]) !== -1)) {
                        const color = categoryColors[key];
                        
                        if (!opt.dataset.colored) {
                            opt.dataset.colored = "true";
                            opt.style.setProperty("border-left", "5px solid " + color, "important");
                            opt.style.setProperty("background-color", color + "15", "important");
                            opt.style.setProperty("font-weight", "600", "important");
                            opt.style.setProperty("padding-left", "10px", "important");
                            opt.style.setProperty("transition", "background-color 0.12s ease, color 0.12s ease", "important");
                            
                            opt.addEventListener("mouseenter", () => {
                                opt.style.setProperty("background-color", color, "important");
                                opt.style.setProperty("color", "#FFFFFF", "important");
                            });
                            opt.addEventListener("mouseleave", () => {
                                opt.style.setProperty("background-color", color + "15", "important");
                                opt.style.setProperty("color", "", "important");
                            });
                        }
                        break;
                    }
                }
            });
        }
        
        styleOptions();
        
        if (!window.parentCatObserver && window.parent && window.parent.document) {
            try {
                window.parentCatObserver = new MutationObserver((mutations) => {
                    styleOptions();
                });
                window.parentCatObserver.observe(window.parent.document.body, { childList: true, subtree: true });
            } catch(e) {}
        }
    })();
    </script>
    """
    st.components.v1.html(js_code, height=0, width=0)


# --- INITIALIZE APP ---
init_db()

st.set_page_config(
    page_title="ODTÜ Oryantiring Finans Takip",
    page_icon="🧭",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Apply global styles
inject_custom_css()

# Today's date logic
today_date = datetime.now().date()
today_str = today_date.strftime('%Y-%m-%d')


# --- SIDEBAR & GLOBAL CONTROLS ---

st.sidebar.markdown(
    """
    <div style='text-align: center; margin-bottom: 25px;'>
        <h2 style='margin-bottom: 5px; color: #3B82F6;'>🧭 ODTÜ Oryantiring</h2>
        <span style='font-size: 0.85rem; color: #64748B; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;'>Mali Yönetim Portalı</span>
    </div>
    """, 
    unsafe_allow_html=True
)

# Read active rate for today from db
if USE_SUPABASE:
    rate_logs = get_rate_logs()
    row = next((r for r in rate_logs if r['date'] <= today_str), None)
    current_active_rate = row['rate'] if row else 0.41
else:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT rate FROM interest_rate_logs WHERE date <= ? ORDER BY date DESC LIMIT 1", (today_str,))
    row = cursor.fetchone()
    current_active_rate = row['rate'] if row else 0.41
    conn.close()

# Navigation
st.sidebar.markdown("---")
st.sidebar.subheader("🧭 Menü")
if "menu_selection" not in st.session_state:
    st.session_state.menu_selection = "📊 Dashboard"

menu_options = [
    "📊 Dashboard", 
    "📝 İşlem Ekle/Düzenle", 
    "🏷️ Kategori Yönetimi", 
    "🤝 Borç Takip Sistemi", 
    "⚙️ Faiz & Geçmişi Düzenle"
]

menu_selection = st.sidebar.radio(
    "Gitmek İstediğiniz Sayfa",
    menu_options,
    key="menu_selection"
)

st.sidebar.markdown("---")
st.sidebar.info(
    "💡 **ON Hesap Faiz Kuralı:**\n"
    "Kasadaki paranın Burgan ON limitlerine göre belirlenen 'vadesiz bakiye' kısmı faizden muaftır. Aşan tutar günlük bileşik faiz ile nemalandırılır. Faiz kazançlarından %17.5 stopaj vergisi kesilmektedir."
)


# --- MAIN PAGE RENDERER ---

# Always run the simulation to get up-to-date data
book_vault, total_interest_earned, daily_log, accumulated_interest = run_simulation()
current_vault = book_vault

if menu_selection == "📊 Dashboard":
    # Get Debts for Dashboard header
    debt_totals = get_pending_debts_totals()
    total_payable = debt_totals['Verilecek']
    total_receivable = debt_totals['Alınacak']
    
    # 1. Centered Header Display (Main Vault)
    st.markdown(f"""
    <div style="text-align: center; margin: 1.5rem 0; font-family: 'Plus Jakarta Sans', sans-serif;">
        <div class="balance-header-grid">
            <!-- Left: Payable (Kırmızı) -->
            <div class="balance-badge badge-payable">
                ( - {total_payable:,.2f} TL )
            </div>
            <!-- Center: Vault -->
            <div class="balance-main">
                {current_vault:,.2f} TL
            </div>
            <!-- Right: Receivable (Yeşil) -->
            <div class="balance-badge badge-receivable">
                ( + {total_receivable:,.2f} TL )
            </div>
        </div>
        <div style="font-size: 0.78rem; color: #64748B; margin-top: 8px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">
            🧭 GÜNCEL KASA DENGESİ VE BORÇLAR
        </div>
        {f"<div style='font-size: 0.78rem; color: #8B5CF6; font-weight: 600; margin-top: 4px; text-align: center;'>⏳ Hesaba Geçecek Birikmiş Net Faiz: +{accumulated_interest:,.2f} TL</div>" if accumulated_interest > 0 else ""}
    </div>
    """, unsafe_allow_html=True)
    
    # 2. Overdue Warning Alert
    all_debts_db = get_debts()
    pending_debts_db = [d for d in all_debts_db if d['status'] == 'Bekliyor']
    overdue_count = 0
    today_check = datetime.now().date()
    for d in pending_debts_db:
        if d['due_date']:
            try:
                due = datetime.strptime(d['due_date'], '%Y-%m-%d').date()
                if due <= today_check:
                    overdue_count += 1
            except Exception:
                pass
    if overdue_count > 0:
        st.error(f"⚠️ **Vadesi Gelmiş/Geçmiş {overdue_count} adet borç işlemi bulunuyor!** Detaylar için sol menüden **🤝 Borç Takip Sistemi** sayfasını ziyaret edebilirsiniz.")

    # 3. Modern Metric Cards
    col1, col2, col3 = st.columns(3)
    
    vadesiz_limit, rate_today, qualifies = get_on_account_details(current_vault, current_active_rate)
    earning_base = max(0.0, current_vault - vadesiz_limit) if qualifies else 0.0
    
    with col1:
        st.markdown(f"""
        <div class="metric-card">
            <span class="metric-marker"></span>
            <div class="metric-title">🛡️ Faiz İşleyen Tutar</div>
            <div class="metric-value">{earning_base:,.2f} TL</div>
            <div class="metric-sub">Vadesiz Kalan: {vadesiz_limit:,.0f} TL | Faiz: %{rate_today*100:.1f}</div>
        </div>
        """, unsafe_allow_html=True)

    with col2:
        st.markdown(f"""
        <div class="metric-card faiz">
            <span class="metric-marker"></span>
            <div class="metric-title">📈 Toplam Biriken Faiz</div>
            <div class="metric-value" style="color: #8B5CF6;">{total_interest_earned:,.2f} TL</div>
            <div class="metric-sub">Kazanılan Net Getiri (%17.5 Stopaj Kesintili)</div>
        </div>
        """, unsafe_allow_html=True)

    with col3:
        m_flow = get_monthly_flow()
        net_flow = m_flow['Gelir'] - m_flow['Gider']
        net_color = "#10B981" if net_flow >= 0 else "#EF4444"
        net_sign = "+" if net_flow >= 0 else ""
        st.markdown(f"""
        <div class="metric-card gider">
            <span class="metric-marker"></span>
            <div class="metric-title">🗓️ Bu Ayki Net Akış</div>
            <div class="metric-value" style="color: {net_color};">{net_sign}{net_flow:,.2f} TL</div>
            <div class="metric-sub">Gelir: +{m_flow['Gelir']:,.1f} TL | Gider: -{m_flow['Gider']:,.1f} TL</div>
        </div>
        """, unsafe_allow_html=True)
        
    st.markdown("<br>", unsafe_allow_html=True)
    
    # 3. Son Yapılan İşlemler (Tam Genişlik & Sayfalamalı)
    st.markdown("### 🕒 Son Yapılan İşlemler")
    recent_txs = get_transactions()
    
    if not recent_txs:
        st.info("Henüz kaydedilmiş bir işlem bulunmuyor.")
    else:
        # Initialize page state
        if 'dash_tx_page' not in st.session_state:
            st.session_state.dash_tx_page = 0
            
        page_size = 5
        total_txs = len(recent_txs)
        total_pages = (total_txs + page_size - 1) // page_size
        
        # Boundary checks
        if st.session_state.dash_tx_page >= total_pages:
            st.session_state.dash_tx_page = total_pages - 1
        if st.session_state.dash_tx_page < 0:
            st.session_state.dash_tx_page = 0
            
        current_page = st.session_state.dash_tx_page
        start_idx = current_page * page_size
        end_idx = start_idx + page_size
        
        # Display transactions for current page
        for tx in recent_txs[start_idx:end_idx]:
            sign = "+" if tx['type'] == 'Gelir' else "-"
            amt_color = "#10B981" if tx['type'] == 'Gelir' else "#EF4444"
            st.markdown(render_tx_row_html(tx, sign, amt_color), unsafe_allow_html=True)
            
        # Pagination controls
        if total_pages > 1:
            p_col1, p_col2, p_col3, p_col4, p_col5 = st.columns([4, 1, 2, 1, 4])
            with p_col2:
                if st.button("◀️", key="prev_dash_tx", disabled=(current_page == 0)):
                    st.session_state.dash_tx_page -= 1
                    st.rerun()
            with p_col3:
                st.markdown(f"<div style='text-align: center; font-weight: 600; font-size: 0.9rem; padding-top: 6px; white-space: nowrap;'>Sayfa {current_page + 1} / {total_pages}</div>", unsafe_allow_html=True)
            with p_col4:
                if st.button("▶️", key="next_dash_tx", disabled=(current_page == total_pages - 1)):
                    st.session_state.dash_tx_page += 1
                    st.rerun()
                    
    st.markdown("<br>", unsafe_allow_html=True)
    
    # 4. Grafikler Bölümü (Alt alta / Yan yana)
    col_chart1, col_chart2 = st.columns(2)
    
    with col_chart1:
        st.markdown("### 📈 Kasa Bakiyesi Zaman Serisi")
        if daily_log:
            df_log = pd.DataFrame(daily_log)
            df_log['Tarih'] = pd.to_datetime(df_log['date'])
            df_log = df_log.rename(columns={'vault_after_interest': 'Kasa Bakiyesi (TL)', 'interest_earned': 'Günlük Faiz (TL)'})
            st.line_chart(df_log, x='Tarih', y='Kasa Bakiyesi (TL)', color="#3B82F6")
        else:
            st.info("Kasa zaman serisini çizmek için yeterli veri bulunamadı. Lütfen bir gelir/gider işlemi ekleyin.")
            
    with col_chart2:
        st.markdown("### 💸 Günlük Faiz Getirisi")
        if daily_log:
            df_log = pd.DataFrame(daily_log)
            df_log['Tarih'] = pd.to_datetime(df_log['date'])
            df_log = df_log.rename(columns={'vault_after_interest': 'Kasa Bakiyesi (TL)', 'interest_earned': 'Günlük Faiz (TL)'})
            st.bar_chart(df_log, x='Tarih', y='Günlük Faiz (TL)', color="#8B5CF6")
        else:
            st.info("Kasa zaman serisini çizmek için yeterli veri bulunamadı. Lütfen bir gelir/gider işlemi ekleyin.")


elif menu_selection == "📝 İşlem Ekle/Düzenle":
    st.title("📝 Gelir / Gider İşlem Yönetimi")
    
    # 1. Transaction creation Form
    categories = get_categories()
    
    if not categories:
        st.warning("⚠️ İşlem eklemeden önce en az bir kategori oluşturmalısınız! Lütfen 'Kategori Yönetimi' sayfasına gidin.")
    else:
        # Check if we are in Edit Mode
        edit_tx_id = st.session_state.get('edit_tx_id')
        edit_tx = None
        if edit_tx_id:
            if USE_SUPABASE:
                client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
                data = client._get("transactions", params={
                    "select": "id,date,category_id,amount,description,time_range,categories(type)",
                    "id": f"eq.{edit_tx_id}"
                })
                if data:
                    row = data[0]
                    edit_tx = {
                        "id": row["id"],
                        "date": row["date"],
                        "category_id": row["category_id"],
                        "amount": row["amount"],
                        "description": row["description"],
                        "time_range": row["time_range"],
                        "type": row["categories"]["type"] if row.get("categories") else None
                    }
            else:
                conn = get_connection()
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT t.id, t.date, t.category_id, t.amount, t.description, t.time_range, c.type
                    FROM transactions t
                    JOIN categories c ON t.category_id = c.id
                    WHERE t.id = ?
                """, (edit_tx_id,))
                row = cursor.fetchone()
                conn.close()
                if row:
                    edit_tx = dict(row)
                
        if edit_tx:
            st.markdown(f"### ✏️ İşlemi Düzenle (ID: #{edit_tx['id']})")
            
            # Prefill values
            try:
                parsed_date = datetime.strptime(edit_tx['date'], '%Y-%m-%d').date()
            except Exception:
                parsed_date = today_date
                
            col_type, col_date, col_time, col_amount = st.columns([3, 3, 4, 3])
            
            with col_type:
                radio_options = ["Gider", "Gelir"]
                default_radio_idx = radio_options.index(edit_tx['type']) if edit_tx['type'] in radio_options else 0
                tx_type = st.radio("İşlem Türü", radio_options, index=default_radio_idx, horizontal=True, key="edit_tx_type")
            
            with col_date:
                tx_date = st.date_input("Tarih", parsed_date, max_value=today_date, key="edit_tx_date")
                
            with col_time:
                time_options = {
                    '05:00 - 18:15': '05:00 - 18:15 (Gün İçi - Bugün)',
                    '18:15 - 23:59': '18:15 - 23:59 (Akşam - Yarın)',
                    '00:00 - 05:00': '00:00 - 05:00 (Gece - Bugün)'
                }
                opt_keys = list(time_options.keys())
                default_time_idx = opt_keys.index(edit_tx['time_range']) if edit_tx['time_range'] in opt_keys else 0
                tx_time = st.selectbox(
                    "Saat Aralığı",
                    options=opt_keys,
                    format_func=lambda x: time_options[x],
                    index=default_time_idx,
                    key="edit_tx_time"
                )
                
            with col_amount:
                tx_amount = st.number_input("Miktar (TL)", min_value=0.01, value=float(edit_tx['amount']), step=50.0, format="%.2f", key="edit_tx_amount")
                
            # Filter categories based on transaction type
            filtered_cats = [c for c in categories if c['type'] == tx_type]
            
            col_cat, col_desc = st.columns([1, 2])
            with col_cat:
                if filtered_cats:
                    cat_options = {c['id']: f"{c['emoji']} {c['name']}" for c in filtered_cats}
                    cat_ids = list(cat_options.keys())
                    try:
                        default_cat_idx = cat_ids.index(edit_tx['category_id'])
                    except ValueError:
                        default_cat_idx = 0
                        
                    selected_cat_id = st.selectbox(
                        "Kategori", 
                        options=cat_ids, 
                        format_func=lambda x: cat_options[x],
                        index=default_cat_idx,
                        key="edit_tx_category"
                    )
                else:
                    st.error(f"Seçilen türde ({tx_type}) kategori bulunamadı.")
                    selected_cat_id = None
                    
            with col_desc:
                tx_desc = st.text_input("Açıklama / Detay", value=edit_tx['description'] or "", key="edit_tx_desc")
                
            col_btn1, col_btn2, col_spacer = st.columns([1, 1, 4])
            with col_btn1:
                submitted = st.button("Değişiklikleri Kaydet", type="primary", key="save_edit_btn")
            with col_btn2:
                canceled = st.button("İptal Et / Düzenlemeden Çık", key="cancel_edit_btn")
                
            if submitted:
                if selected_cat_id is None:
                    st.error("Kategori seçimi zorunludur.")
                else:
                    date_str = tx_date.strftime('%Y-%m-%d')
                    update_transaction(edit_tx['id'], date_str, selected_cat_id, tx_amount, tx_desc, tx_time)
                    st.session_state.edit_tx_id = None
                    st.toast("İşlem başarıyla güncellendi ve tüm bakiye geçmişi yeniden hesaplandı!", icon="✏️")
                    st.rerun()
                    
            if canceled:
                st.session_state.edit_tx_id = None
                st.rerun()
                
        else:
            st.markdown("### ➕ Yeni İşlem Kaydet")
            
            col_type, col_date, col_time, col_amount = st.columns([3, 3, 4, 3])
            
            with col_type:
                tx_type = st.radio("İşlem Türü", ["Gider", "Gelir"], index=None, horizontal=True)
            
            with col_date:
                tx_date = st.date_input("Tarih", today_date, max_value=today_date)
                
            with col_time:
                time_options = {
                    '05:00 - 18:15': '05:00 - 18:15 (Gün İçi - Bugün)',
                    '18:15 - 23:59': '18:15 - 23:59 (Akşam - Yarın)',
                    '00:00 - 05:00': '00:00 - 05:00 (Gece - Bugün)'
                }
                tx_time = st.selectbox(
                    "Saat Aralığı",
                    options=list(time_options.keys()),
                    format_func=lambda x: time_options[x],
                    index=0,
                    help="Gecelik faizin işletileceği matrahın hangi günden itibaren hesaplanacağını belirlemek için gereklidir."
                )
                
            with col_amount:
                tx_amount = st.number_input("Miktar (TL)", min_value=0.01, step=50.0, format="%.2f")
                
            # Filter categories based on transaction type
            filtered_cats = [c for c in categories if c['type'] == tx_type] if tx_type else []
            
            col_cat, col_desc = st.columns([1, 2])
            with col_cat:
                if tx_type is None:
                    st.info("Kategori listelemek için lütfen işlem türü seçin.")
                    selected_cat_id = None
                elif filtered_cats:
                    cat_options = {c['id']: f"{c['emoji']} {c['name']}" for c in filtered_cats}
                    selected_cat_id = st.selectbox(
                        "Kategori", 
                        options=list(cat_options.keys()), 
                        format_func=lambda x: cat_options[x]
                    )
                else:
                    st.error(f"Seçilen türde ({tx_type}) kategori bulunamadı.")
                    selected_cat_id = None
                    
            with col_desc:
                tx_desc = st.text_input("Açıklama / Detay")
                
            submitted = st.button("İşlemi Kaydet", type="primary")
            
            if submitted:
                if tx_type is None:
                    st.error("İşlem türü seçimi zorunludur.")
                elif selected_cat_id is None:
                    st.error("Kategori seçimi zorunludur.")
                else:
                    date_str = tx_date.strftime('%Y-%m-%d')
                    add_transaction(date_str, selected_cat_id, tx_amount, tx_desc, time_range=tx_time)
                    st.success("İşlem başarıyla eklendi! Zaman serisi ve bileşik faizler yeniden hesaplandı.")
                    st.rerun()

    # 2. Complete Transaction List
    st.markdown("---")
    st.markdown("### 📋 İşlem Geçmişi")
    
    all_txs = get_transactions()
    if not all_txs:
        st.info("İşlem geçmişiniz henüz boş.")
    else:
        # Search & Filter
        search_query = st.text_input("🔍 Açıklama veya kategori ara...", "").lower()
        
        # Deletion confirmation
        if st.session_state.get('confirm_delete_id'):
            del_id = st.session_state.confirm_delete_id
            del_tx = next((t for t in all_txs if t['id'] == del_id), None)
            if del_tx:
                st.warning(f"⚠️ **Seçilen işlemi silmek istediğinize emin misiniz?**\n\n**{del_tx['date']} | {del_tx['category_emoji']} {del_tx['category_name']} | {del_tx['description'] or ''} | {del_tx['amount']:,.2f} TL**")
                col_yes, col_no = st.columns([1, 1])
                with col_yes:
                    if st.button("Evet, Sil", key="btn_confirm_del_yes", type="primary"):
                        delete_transaction(del_id)
                        if st.session_state.get('edit_tx_id') == del_id:
                            st.session_state.edit_tx_id = None
                        st.session_state.confirm_delete_id = None
                        st.toast("İşlem silindi, bakiye yeniden hesaplandı.", icon="🗑️")
                        st.rerun()
                with col_no:
                    if st.button("İptal Et", key="btn_confirm_del_no"):
                        st.session_state.confirm_delete_id = None
                        st.rerun()
            else:
                st.session_state.confirm_delete_id = None
        
        filtered_txs = []
        for tx in all_txs:
            matches_search = (
                search_query in (tx['description'] or '').lower() or 
                search_query in tx['category_name'].lower() or
                search_query in tx['date']
            )
            if matches_search:
                filtered_txs.append(tx)
                
        if not filtered_txs:
            st.info("Aramanıza uygun işlem bulunamadı.")
        else:
            # Custom styled list with Delete and Edit Actions
            for tx in filtered_txs:
                col_item, col_actions = st.columns([12, 2])
                
                with col_item:
                    st.markdown('<span class="tx-card-marker"></span>', unsafe_allow_html=True)
                    sign = "+" if tx['type'] == 'Gelir' else "-"
                    amt_color = "#10B981" if tx['type'] == 'Gelir' else "#EF4444"
                    
                    st.markdown(render_tx_row_html(tx, sign, amt_color, extra_style="margin-bottom: 0;"), unsafe_allow_html=True)
                    
                with col_actions:
                    st.markdown('<span class="tx-actions-marker"></span>', unsafe_allow_html=True)
                    c_edit, c_del = st.columns(2)
                    with c_edit:
                        if st.button("✏️", key=f"edit_tx_{tx['id']}", help="İşlemi Düzenle"):
                            st.session_state.edit_tx_id = tx['id']
                            st.rerun()
                    with c_del:
                        if st.button("🗑️", key=f"del_tx_{tx['id']}", help="İşlemi Sil"):
                            st.session_state.confirm_delete_id = tx['id']
                            st.rerun()


elif menu_selection == "🏷️ Kategori Yönetimi":
    st.title("🏷️ Kategori Yönetimi (Spendee)")
    
    col_add, col_list = st.columns([1, 1])
    
    # Check if category is being edited
    edit_cat_id = st.session_state.get('edit_cat_id')
    edit_cat = None
    if edit_cat_id:
        if USE_SUPABASE:
            client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
            data = client._get("categories", params={"id": f"eq.{edit_cat_id}"})
            if data:
                edit_cat = data[0]
        else:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, emoji, color, type FROM categories WHERE id = ?", (edit_cat_id,))
            row = cursor.fetchone()
            conn.close()
            if row:
                edit_cat = dict(row)
            
    with col_add:
        st.markdown('<span class="cat-page-marker"></span>', unsafe_allow_html=True)
        if edit_cat:
            st.markdown(f"### ✏️ Kategoriyi Düzenle (ID: #{edit_cat['id']})")
            cat_name = st.text_input("Kategori Adı", value=edit_cat['name'], key="edit_cat_name")
            cat_type = st.radio("Kategori Türü", ["Gider", "Gelir"], 
                                 index=0 if edit_cat['type'] == 'Gider' else 1, 
                                 horizontal=True, key="edit_cat_type")
            
            if "edit_cat_color_val" not in st.session_state or st.session_state.get("edit_cat_id_current") != edit_cat['id']:
                st.session_state.edit_cat_color_val = edit_cat['color']
                st.session_state.edit_cat_id_current = edit_cat['id']
                st.session_state.edit_cat_emoji_val = edit_cat['emoji']
                
            cat_color = st.color_picker("Rozet Rengi (Hex)", value=st.session_state.edit_cat_color_val, key="edit_cat_color_picker")
            st.session_state.edit_cat_color_val = cat_color

            st.markdown(f"**Rozet Simgesi:** <span style='font-size: 1.3rem; margin-left: 10px;'>{st.session_state.edit_cat_emoji_val}</span>", unsafe_allow_html=True)
            emoji_options = [
                "🧭", "🏃", "🗺️", "👟", "🏆", "🎓",
                "🌲", "🏕️", "🪵", "🎒", "🩹", "🏥",
                "🍕", "🥤", "🍽️", "👕", "🏠", "🚗",
                "🪙", "💰", "💵", "💳", "🤝", "🛒",
                "✈️", "🍿", "🎮", "🐾", "🎁", "🛠️"
            ]
            
            cols = st.columns(6)
            for i, emoji_char in enumerate(emoji_options):
                col = cols[i % 6]
                if i == 0:
                    with col:
                        st.markdown('<span class="emoji-marker"></span>', unsafe_allow_html=True)
                is_selected = emoji_char == st.session_state.edit_cat_emoji_val
                btn_label = f"• {emoji_char} •" if is_selected else emoji_char
                if col.button(btn_label, key=f"edit_emoji_{emoji_char}"):
                    st.session_state.edit_cat_emoji_val = emoji_char
                    st.rerun()
                    
            col_btn1, col_btn2 = st.columns([1, 1])
            with col_btn1:
                submitted = st.button("Değişiklikleri Kaydet", type="primary", key="save_edit_cat_btn")
            with col_btn2:
                canceled = st.button("İptal Et", key="cancel_edit_cat_btn")
                
            if submitted:
                if not cat_name.strip():
                    st.error("Kategori adı boş olamaz!")
                else:
                    update_category(edit_cat['id'], cat_name.strip(), st.session_state.edit_cat_emoji_val, cat_color, cat_type)
                    st.session_state.edit_cat_id = None
                    st.toast("Kategori başarıyla güncellendi ve tüm bakiye geçmişi yeniden hesaplandı!", icon="✏️")
                    st.rerun()
            if canceled:
                st.session_state.edit_cat_id = None
                st.rerun()
        else:
            st.markdown("### ➕ Yeni Kategori Oluştur")
            cat_name = st.text_input("Kategori Adı", placeholder="Örn: Aidat, Ulaşım, Kamp", key="new_cat_name")
            cat_type = st.radio("Kategori Türü", ["Gider", "Gelir"], index=None, horizontal=True, key="new_cat_type")
            
            if "new_cat_color" not in st.session_state:
                st.session_state.new_cat_color = "#64748B"
                
            if cat_type is not None:
                if "last_cat_type" not in st.session_state or st.session_state.last_cat_type != cat_type:
                    st.session_state.last_cat_type = cat_type
                    st.session_state.new_cat_color = "#3B82F6" if cat_type == "Gelir" else "#EF4444"
                
            cat_color = st.color_picker("Rozet Rengi (Hex)", value=st.session_state.new_cat_color, key="new_cat_color_picker")
            st.session_state.new_cat_color = cat_color

            if "new_cat_emoji" not in st.session_state:
                st.session_state.new_cat_emoji = "🧭"
                
            st.markdown(f"**Rozet Simgesi:** <span style='font-size: 1.3rem; margin-left: 10px;'>{st.session_state.new_cat_emoji}</span>", unsafe_allow_html=True)
            emoji_options = [
                "🧭", "🏃", "🗺️", "👟", "🏆", "🎓",
                "🌲", "🏕️", "🪵", "🎒", "🩹", "🏥",
                "🍕", "🥤", "🍽️", "👕", "🏠", "🚗",
                "🪙", "💰", "💵", "💳", "🤝", "🛒",
                "✈️", "🍿", "🎮", "🐾", "🎁", "🛠️"
            ]
            
            cols = st.columns(6)
            for i, emoji_char in enumerate(emoji_options):
                col = cols[i % 6]
                if i == 0:
                    with col:
                        st.markdown('<span class="emoji-marker"></span>', unsafe_allow_html=True)
                is_selected = emoji_char == st.session_state.new_cat_emoji
                btn_label = f"• {emoji_char} •" if is_selected else emoji_char
                if col.button(btn_label, key=f"new_emoji_{emoji_char}"):
                    st.session_state.new_cat_emoji = emoji_char
                    st.rerun()
                    
            submitted = st.button("Kategoriyi Ekle", type="primary", key="add_cat_btn")
            if submitted:
                if not cat_name.strip():
                    st.error("Kategori adı boş olamaz!")
                elif cat_type is None:
                    st.error("Kategori türü (Gider/Gelir) seçilmesi zorunludur!")
                else:
                    add_category(cat_name.strip(), st.session_state.new_cat_emoji, cat_color, cat_type)
                    st.success(f"'{st.session_state.new_cat_emoji} {cat_name}' kategorisi başarıyla oluşturuldu!")
                    st.session_state.new_cat_emoji = "🧭"
                    if "new_cat_type" in st.session_state:
                        del st.session_state["new_cat_type"]
                    st.rerun()
                    
    with col_list:
        st.markdown("### 📋 Mevcut Kategoriler")
        cats = get_categories()
        if not cats:
            st.info("Kayıtlı kategori bulunamadı. Sol taraftaki formu kullanarak yeni kategoriler ekleyebilirsiniz.")
        else:
            # Deletion confirmation
            if st.session_state.get('confirm_delete_cat_id'):
                del_id = st.session_state.confirm_delete_cat_id
                del_c = next((c for c in cats if c['id'] == del_id), None)
                if del_c:
                    st.warning(f"⚠️ **Seçilen kategoriyi silmek istediğinize emin misiniz?**\n\n**Bu kategori silinirse bağlı TÜM işlemler de silinecektir!**\n\nKategori: **{del_c['emoji']} {del_c['name']}**")
                    col_yes, col_no = st.columns([1, 1])
                    with col_yes:
                        if st.button("Evet, Sil", key="btn_confirm_cat_del_yes", type="primary"):
                            delete_category(del_id)
                            if st.session_state.get('edit_cat_id') == del_id:
                                st.session_state.edit_cat_id = None
                            st.session_state.confirm_delete_cat_id = None
                            st.toast("Kategori silindi, faizler ve bakiyeler yeniden hesaplandı.", icon="🗑️")
                            st.rerun()
                    with col_no:
                        if st.button("İptal Et", key="btn_confirm_cat_del_no"):
                            st.session_state.confirm_delete_cat_id = None
                            st.rerun()
                else:
                    st.session_state.confirm_delete_cat_id = None

            for c in cats:
                col_badge, col_type_lbl, col_edit, col_del = st.columns([6, 2, 1, 1])
                
                with col_badge:
                    st.markdown('<span class="cat-row-marker"></span>', unsafe_allow_html=True)
                    st.markdown(get_category_badge_html(c['emoji'], c['name'], c['color']), unsafe_allow_html=True)
                
                with col_type_lbl:
                    lbl_color = "#10B981" if c['type'] == "Gelir" else "#EF4444"
                    st.markdown(f"<div style='color: {lbl_color}; font-weight: 700; padding-top: 6px;'>{c['type']}</div>", unsafe_allow_html=True)
                    
                with col_edit:
                    st.markdown('<span class="cat-actions-marker"></span>', unsafe_allow_html=True)
                    if st.button("✏️", key=f"edit_cat_btn_{c['id']}", help="Kategoriyi Düzenle"):
                        st.session_state.edit_cat_id = c['id']
                        st.rerun()
                        
                with col_del:
                    st.markdown('<span class="cat-actions-marker"></span>', unsafe_allow_html=True)
                    if st.button("🗑️", key=f"del_cat_{c['id']}", help="Bu kategori silinirse bağlı TÜM işlemler de silinecektir!"):
                        st.session_state.confirm_delete_cat_id = c['id']
                        st.rerun()


elif menu_selection == "🤝 Borç Takip Sistemi":
    # Calculate overdue alerts first
    all_debts = get_debts()
    pending_debts = [d for d in all_debts if d['status'] == 'Bekliyor']
    
    overdue_receivables = []
    overdue_payables = []
    today = today_date
    
    for d in pending_debts:
        if d['due_date']:
            try:
                due = datetime.strptime(d['due_date'], '%Y-%m-%d').date()
                if due <= today:
                    diff = (today - due).days
                    d['days_overdue'] = diff
                    if d['type'] == 'Alınacak':
                        overdue_receivables.append(d)
                    else:
                        overdue_payables.append(d)
            except Exception:
                pass

    st.title("🤝 Borç Takip Sistemi (Alınacak & Verilecek)")
    
    # Render Overdue Notifications
    if overdue_receivables or overdue_payables:
        st.markdown("### 🔔 Önemli Vade Bildirimleri")
        for d in overdue_payables:
            diff = d['days_overdue']
            time_str = "bugün!" if diff == 0 else f"{diff} gün gecikti!"
            st.error(f"🚨 **Ödeme Gecikmesi (Bizim Ödeyeceğimiz):** **{d['name']}** kişisine/kurumuna yapılacak **{d['amount']:,.2f} TL** ödemenin vadesi {time_str}")
        for d in overdue_receivables:
            diff = d['days_overdue']
            time_str = "bugün!" if diff == 0 else f"{diff} gün gecikti!"
            st.warning(f"⚠️ **Alacak Gecikmesi (Bize Ödenecek):** **{d['name']}** kişisinden gelecek **{d['amount']:,.2f} TL** alacağın vadesi {time_str}")
        st.markdown("<br>", unsafe_allow_html=True)

    # Calculate Summary
    debt_totals = get_pending_debts_totals()
    total_payable = debt_totals['Verilecek']
    total_receivable = debt_totals['Alınacak']
    
    col_tot1, col_tot2 = st.columns(2)
    with col_tot1:
        st.markdown(f"""
        <div class="metric-card gider" style="text-align: center;">
            <span class="debt-summary-marker"></span>
            <div class="metric-title">🔴 Toplam Verilecek Borçlar</div>
            <div class="metric-value" style="color: #EF4444;">{total_payable:,.2f} TL</div>
            <div class="metric-sub">Dışarıya Gidecek Toplam Tutar</div>
        </div>
        """, unsafe_allow_html=True)
        
    with col_tot2:
        st.markdown(f"""
        <div class="metric-card" style="text-align: center;">
            <span class="debt-summary-marker"></span>
            <div class="metric-title">🟢 Toplam Alınacak Borçlar</div>
            <div class="metric-value" style="color: #10B981;">{total_receivable:,.2f} TL</div>
            <div class="metric-sub">Kasamıza Gelecek Toplam Tutar</div>
        </div>
        """, unsafe_allow_html=True)
        
    st.markdown("<br>", unsafe_allow_html=True)
    
    col_add, col_list = st.columns([1, 2])
    
    # Load categories for debt mapping
    categories = get_categories()
    
    # Check if debt is being edited
    edit_debt_id = st.session_state.get('edit_debt_id')
    edit_debt = None
    if edit_debt_id:
        if USE_SUPABASE:
            client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
            data = client._get("debts", params={"id": f"eq.{edit_debt_id}"})
            if data:
                edit_debt = data[0]
        else:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, type, amount, name, due_date, status, category_id FROM debts WHERE id = ?", (edit_debt_id,))
            row = cursor.fetchone()
            conn.close()
            if row:
                edit_debt = dict(row)
            
    with col_add:
        if edit_debt:
            st.markdown(f"### ✏️ Borç Kaydını Düzenle (ID: #{edit_debt['id']})")
            debt_type = st.radio("Borç Türü", ["Alınacak", "Verilecek"], 
                                 index=0 if edit_debt['type'] == 'Alınacak' else 1, 
                                 horizontal=True, key="edit_debt_type")
            debt_name = st.text_input("Kişi / Kurum Adı", value=edit_debt['name'], key="edit_debt_name")
            debt_amount = st.number_input("Miktar (TL)", min_value=0.01, value=float(edit_debt['amount']), step=100.0, format="%.2f", key="edit_debt_amount")
            
            # Filter categories based on debt type:
            # Alınacak -> Gelir categories
            # Verilecek -> Gider categories
            cat_type_needed = "Gelir" if debt_type == "Alınacak" else "Gider"
            filtered_cats = [c for c in categories if c['type'] == cat_type_needed]
            
            if filtered_cats:
                cat_options = {c['id']: f"{c['emoji']} {c['name']}" for c in filtered_cats}
                cat_ids = list(cat_options.keys())
                try:
                    default_cat_idx = cat_ids.index(edit_debt['category_id']) if edit_debt['category_id'] in cat_ids else 0
                except ValueError:
                    default_cat_idx = 0
                selected_cat_id = st.selectbox(
                    "Kategori", 
                    options=cat_ids, 
                    format_func=lambda x: cat_options[x],
                    index=default_cat_idx,
                    key="edit_debt_category"
                )
            else:
                st.error(f"Seçilen tür için ({cat_type_needed}) uygun bir kategori bulunamadı. Lütfen önce Kategori Yönetimi sayfasından bir kategori oluşturun.")
                selected_cat_id = None
                
            has_due_date = st.checkbox("Vade Tarihi Var", value=edit_debt['due_date'] is not None, key="edit_debt_has_due")
            if has_due_date:
                try:
                    parsed_due = datetime.strptime(edit_debt['due_date'], '%Y-%m-%d').date()
                except Exception:
                    parsed_due = today_date
                debt_due_date = st.date_input("Vade Tarihi", parsed_due, key="edit_debt_due")
            else:
                debt_due_date = None
            
            status_options = ["Bekliyor", "Ödendi"]
            default_status_idx = status_options.index(edit_debt['status']) if edit_debt['status'] in status_options else 0
            debt_status = st.selectbox("Durum", status_options, index=default_status_idx, key="edit_debt_status")
            
            col_btn1, col_btn2 = st.columns([1, 1])
            with col_btn1:
                submitted = st.button("Değişiklikleri Kaydet", type="primary", key="save_edit_debt_btn")
            with col_btn2:
                canceled = st.button("İptal Et", key="cancel_edit_debt_btn")
                
            if submitted:
                if not debt_name.strip():
                    st.error("Kişi/Kurum adı boş bırakılamaz!")
                elif selected_cat_id is None:
                    st.error("Kategori seçimi zorunludur. Lütfen geçerli bir kategori seçin.")
                else:
                    due_date_str = debt_due_date.strftime('%Y-%m-%d') if has_due_date else None
                    update_debt(edit_debt['id'], debt_type, debt_amount, debt_name.strip(), due_date_str, debt_status, selected_cat_id)
                    st.session_state.edit_debt_id = None
                    st.toast("Borç kaydı başarıyla güncellendi!", icon="✏️")
                    st.rerun()
            if canceled:
                st.session_state.edit_debt_id = None
                st.rerun()
        else:
            st.markdown("### ➕ Yeni Borç Kaydı")
            debt_type = st.radio("Borç Türü", ["Alınacak", "Verilecek"], horizontal=True, help="Alınacak: Bize gelecek para | Verilecek: Bizim ödeyeceğimiz para", key="new_debt_type")
            debt_name = st.text_input("Kişi / Kurum Adı", placeholder="Örn: Ahmet Yılmaz, Spor Genel Md.", key="new_debt_name")
            debt_amount = st.number_input("Miktar (TL)", min_value=0.01, step=100.0, format="%.2f", key="new_debt_amount")
            
            # Filter categories based on debt type:
            # Alınacak -> Gelir categories
            # Verilecek -> Gider categories
            cat_type_needed = "Gelir" if debt_type == "Alınacak" else "Gider"
            filtered_cats = [c for c in categories if c['type'] == cat_type_needed]
            
            if filtered_cats:
                cat_options = {c['id']: f"{c['emoji']} {c['name']}" for c in filtered_cats}
                selected_cat_id = st.selectbox(
                    "Kategori", 
                    options=list(cat_options.keys()), 
                    format_func=lambda x: cat_options[x],
                    key="new_debt_category"
                )
            else:
                st.error(f"Seçilen tür için ({cat_type_needed}) uygun bir kategori bulunamadı. Lütfen önce Kategori Yönetimi sayfasından bir kategori oluşturun.")
                selected_cat_id = None
                
            has_due_date = st.checkbox("Vade Tarihi Var", key="new_debt_has_due")
            if has_due_date:
                debt_due_date = st.date_input("Vade Tarihi", today_date, key="new_debt_due")
            else:
                debt_due_date = None
                
            submitted = st.button("Borç Ekle", type="primary", key="add_debt_btn")
            if submitted:
                if not debt_name.strip():
                    st.error("Kişi/Kurum adı boş bırakılamaz!")
                elif selected_cat_id is None:
                    st.error("Kategori seçimi zorunludur. Lütfen geçerli bir kategori seçin.")
                else:
                    due_date_str = debt_due_date.strftime('%Y-%m-%d') if has_due_date else None
                    add_debt(debt_type, debt_amount, debt_name.strip(), due_date_str, "Bekliyor", selected_cat_id)
                    st.toast("Borç kaydı başarıyla eklendi!", icon="➕")
                    st.rerun()
                    
    with col_list:
        st.markdown("### 📋 Borçlar Listesi")
        if not all_debts:
            st.info("Kayıtlı herhangi bir borç bulunamadı.")
        else:
            # Deletion confirmation
            if st.session_state.get('confirm_delete_debt_id'):
                del_id = st.session_state.confirm_delete_debt_id
                del_d = next((d for d in all_debts if d['id'] == del_id), None)
                if del_d:
                    st.warning(f"⚠️ **Seçilen borç kaydını silmek istediğinize emin misiniz?**\n\n**{del_d['name']} | {del_d['amount']:,.2f} TL | {del_d['type']}**")
                    col_yes, col_no = st.columns([1, 1])
                    with col_yes:
                        if st.button("Evet, Sil", key="btn_confirm_debt_del_yes", type="primary"):
                            delete_debt(del_id)
                            if st.session_state.get('edit_debt_id') == del_id:
                                st.session_state.edit_debt_id = None
                            st.session_state.confirm_delete_debt_id = None
                            st.toast("Borç kaydı silindi.", icon="🗑️")
                            st.rerun()
                    with col_no:
                        if st.button("İptal Et", key="btn_confirm_debt_del_no"):
                            st.session_state.confirm_delete_debt_id = None
                            st.rerun()
                else:
                    st.session_state.confirm_delete_debt_id = None

            tab_pending, tab_paid = st.tabs(["⏳ Bekleyen Borçlar", "✅ Ödenmiş Borçlar"])
            
            with tab_pending:
                pending_debts = [d for d in all_debts if d['status'] == 'Bekliyor']
                if not pending_debts:
                    st.success("Bekleyen borcunuz bulunmuyor! Her şey dengede.")
                else:
                    for d in pending_debts:
                        # Toggle expansion logic
                        expanded_key = f"debt_expanded_{d['id']}"
                        if expanded_key not in st.session_state:
                            st.session_state[expanded_key] = False
                        is_expanded = st.session_state[expanded_key]

                        # Full-width card
                        color = "#EF4444" if d['type'] == 'Verilecek' else "#10B981"
                        type_lbl = "🔴 Verilecek" if d['type'] == 'Verilecek' else "🟢 Alınacak"
                        vade_lbl = f" | 📅 Vade: {d['due_date']}" if d['due_date'] else " | 📅 Vade: Belirsiz"
                        badge_html = get_debt_badge_html(d['due_date'])
                        if d['category_name']:
                            cat_badge = f"<span style='background-color: {d['category_color']}15; color: {d['category_color']}; padding: 2px 8px; border-radius: 8px; font-weight: 600; font-size: 0.75rem; border: 1px solid {d['category_color']}30; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;'><span style='font-size: 0.8rem;'>{d['category_emoji']}</span><span>{d['category_name']}</span></span>"
                        else:
                            cat_badge = ""
                        
                        chevron = "▲" if is_expanded else "▼"

                        # Wrapped inside a relative container with invisible button overlay
                        with st.container():
                            st.markdown('<span class="debt-wrapper-marker"></span>', unsafe_allow_html=True)
                            st.markdown(
                                f"<div class='debt-info-card' style='padding: 12px; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 6px; cursor: pointer; position: relative;'>"
                                f"<div style='display: flex; justify-content: space-between; align-items: center; gap: 8px;'>"
                                f"<div style='min-width: 0; flex-shrink: 1;'><strong>{d['name']}</strong>{badge_html}</div>"
                                f"<span style='color: {color}; font-weight: 700; white-space: nowrap; flex-shrink: 0; display: flex; align-items: center; gap: 6px;'>"
                                f"{d['amount']:,.2f} TL <span class='debt-chevron' style='font-size: 0.85rem; color: #94A3B8;'>{chevron}</span></span>"
                                f"</div>"
                                f"<div style='font-size: 0.8rem; color: #64748B; margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap;'>"
                                f"<span>{type_lbl}{vade_lbl}</span>{cat_badge}"
                                f"</div>"
                                f"</div>",
                                unsafe_allow_html=True
                            )
                            if st.button("Expand", key=f"toggle_pending_debt_{d['id']}"):
                                st.session_state[expanded_key] = not is_expanded
                                st.rerun()

                        # Action buttons in compact horizontal row below the card (only if expanded)
                        if is_expanded:
                            c_paid, c_edit, c_del = st.columns(3)
                            with c_paid:
                                st.markdown('<span class="debt-btn-row"></span>', unsafe_allow_html=True)
                                if st.button("✔️", key=f"pay_debt_{d['id']}", help="Ödendi olarak işaretle"):
                                    if not d['category_id']:
                                        st.toast("⚠️ Ödeme alabilmek için borca önce bir kategori seçmelisiniz! (✏️ Düzenle butonunu kullanın)", icon="⚠️")
                                    else:
                                        update_debt_status(d['id'], "Ödendi")
                                        st.toast("Borç ödendi olarak güncellendi.", icon="✅")
                                        st.rerun()
                            with c_edit:
                                if st.button("✏️", key=f"edit_debt_btn_{d['id']}", help="Borcu Düzenle"):
                                    st.session_state.edit_debt_id = d['id']
                                    st.rerun()
                            with c_del:
                                if st.button("🗑️", key=f"del_debt_{d['id']}", help="Borcu Sil"):
                                    st.session_state.confirm_delete_debt_id = d['id']
                                    st.rerun()
                                    
            with tab_paid:
                paid_debts = [d for d in all_debts if d['status'] == 'Ödendi']
                if not paid_debts:
                    st.info("Ödenmiş borç geçmişi bulunmuyor.")
                else:
                    for d in paid_debts:
                        # Toggle expansion logic
                        expanded_key = f"debt_expanded_{d['id']}"
                        if expanded_key not in st.session_state:
                            st.session_state[expanded_key] = False
                        is_expanded = st.session_state[expanded_key]

                        # Full-width card
                        color = "#94A3B8"
                        type_lbl = "Verilecek" if d['type'] == 'Verilecek' else "Alınacak"
                        if d['category_name']:
                            cat_badge = f"<span style='background-color: {d['category_color']}15; color: {d['category_color']}; padding: 2px 8px; border-radius: 8px; font-weight: 600; font-size: 0.75rem; border: 1px solid {d['category_color']}30; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;'><span style='font-size: 0.8rem;'>{d['category_emoji']}</span><span>{d['category_name']}</span></span>"
                        else:
                            cat_badge = ""
                        
                        chevron = "▲" if is_expanded else "▼"

                        # Wrapped inside a relative container with invisible button overlay
                        with st.container():
                            st.markdown('<span class="debt-wrapper-marker"></span>', unsafe_allow_html=True)
                            st.markdown(
                                f"<div class='debt-info-card' style='padding: 12px; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 6px; opacity: 0.75; background: #F8FAFC; cursor: pointer; position: relative;'>"
                                f"<div style='display: flex; justify-content: space-between; align-items: center; gap: 8px;'>"
                                f"<del style='min-width: 0; flex-shrink: 1;'><strong>{d['name']}</strong></del>"
                                f"<span style='color: {color}; font-weight: 700; text-decoration: line-through; white-space: nowrap; flex-shrink: 0; display: flex; align-items: center; gap: 6px;'>"
                                f"{d['amount']:,.2f} TL <span class='debt-chevron' style='font-size: 0.85rem; color: #94A3B8;'>{chevron}</span></span>"
                                f"</div>"
                                f"<div style='font-size: 0.8rem; color: #64748B; margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap;'>"
                                f"<span>✅ Ödendi ({type_lbl})</span>{cat_badge}"
                                f"</div>"
                                f"</div>",
                                unsafe_allow_html=True
                            )
                            if st.button("Expand", key=f"toggle_paid_debt_{d['id']}"):
                                st.session_state[expanded_key] = not is_expanded
                                st.rerun()

                        # Action buttons in compact horizontal row below the card (only if expanded)
                        if is_expanded:
                            c_unpay, c_edit, c_del = st.columns(3)
                            with c_unpay:
                                st.markdown('<span class="debt-btn-row"></span>', unsafe_allow_html=True)
                                if st.button("⏪", key=f"unpay_debt_{d['id']}", help="Geri Al (Bekliyor yap)"):
                                    update_debt_status(d['id'], "Bekliyor")
                                    st.toast("Borç tekrar bekliyor statüsüne alındı.", icon="⏪")
                                    st.rerun()
                            with c_edit:
                                if st.button("✏️", key=f"edit_paid_debt_btn_{d['id']}", help="Borcu Düzenle"):
                                    st.session_state.edit_debt_id = d['id']
                                    st.rerun()
                            with c_del:
                                if st.button("🗑️", key=f"del_paid_debt_{d['id']}", help="Kayıttan Sil"):
                                    st.session_state.confirm_delete_debt_id = d['id']
                                    st.rerun()


elif menu_selection == "⚙️ Faiz & Geçmişi Düzenle":
    st.title("⚙️ Faiz Ayarları ve Simülasyon Detayları")
    
    tab_faiz, tab_log = st.tabs(["📈 Faiz Oranı Kayıtları", "🔍 Günlük Hesaplama Detayları"])
    
    with tab_faiz:
        col_new_log, col_log_history = st.columns([1, 1])
        
        with col_new_log:
            st.markdown("### ➕ Yeni Faiz Oranı Değişikliği Ekle")
            st.info("Bu bölüm geçmiş bir tarihe ait veya yeni bir faiz başlangıcı kaydı eklemenizi sağlar. Sistem tüm geçmişi bu tarihten itibaren yeniden simüle edecektir.")
            
            with st.form("new_rate_log_form", clear_on_submit=True):
                log_date = st.date_input("Geçerlilik Başlangıç Tarihi", today_date, max_value=today_date)
                log_rate = st.selectbox("Yıllık Faiz Oranı", [0.41, 0.45], format_func=lambda x: f"%{int(x*100)}")
                
                submitted = st.form_submit_button("Faiz Değişikliğini Kaydet")
                if submitted:
                    date_str = log_date.strftime('%Y-%m-%d')
                    add_or_update_rate_log(date_str, log_rate)
                    st.success(f"{date_str} tarihinden itibaren geçerli faiz oranı %{int(log_rate*100)} olarak kaydedildi!")
                    st.rerun()
                    
        with col_log_history:
            st.markdown("### 📋 Kayıtlı Faiz Oranları Tarihçesi")
            logs = get_rate_logs()
            
            if not logs:
                st.info("Kayıtlı faiz logu bulunamadı.")
            else:
                for l in logs:
                    col_info, col_action = st.columns([6, 2])
                    with col_info:
                        st.markdown(f"""
                        <div style="padding: 10px; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 8px;">
                            <strong>Başlangıç Tarihi:</strong> {l['date']} <br>
                            <strong>Faiz Oranı (Yıllık):</strong> %{int(l['rate']*100)}
                        </div>
                        """, unsafe_allow_html=True)
                    with col_action:
                        st.write("") # alignment
                        # Disable deleting the baseline log if it's the only one left
                        if len(logs) > 1:
                            if st.button("Sil", key=f"del_rate_{l['id']}", help="Bu faiz kaydını sil. Sistem yeniden simüle edecektir."):
                                delete_rate_log(l['id'])
                                st.toast("Faiz kaydı silindi, bakiye yeniden hesaplandı.", icon="🗑️")
                                st.rerun()
                        else:
                            st.button("Sil", key=f"del_rate_{l['id']}", disabled=True, help="Sistemde en az 1 faiz kaydı bulunmalıdır.")
                            
    with tab_log:
        st.markdown("### 🔍 Simülasyon Günlük Detayları (Son 30 Gün)")
        st.markdown("Aşağıdaki tablo, en eski işlemden bugüne kadar zaman motorunun gün gün nasıl çalıştığını gösterir.")
        
        if not daily_log:
            st.info("Henüz simüle edilecek veri bulunmuyor. Lütfen Kategori ve İşlem ekleyin.")
        else:
            df_full = pd.DataFrame(daily_log)
            # Reorder and rename columns for clarity
            df_full = df_full.rename(columns={
                'date': 'Tarih',
                'vault_before_interest': 'Gün Başı Kasa (TL)',
                'income': 'Giren Para (TL)',
                'expense': 'Çıkan Para (TL)',
                'vadesiz_limit': 'Vadesiz Bakiye (TL)',
                'earning_base': 'Faiz İşleyen Matrah (TL)',
                'interest_earned': 'Net Faiz Getirisi (TL)',
                'vault_after_interest': 'Gün Sonu Kasa (TL)',
                'rate': 'Uygulanan Faiz Oranı'
            })
            
            # Format rates to percentage
            df_full['Uygulanan Faiz Oranı'] = df_full['Uygulanan Faiz Oranı'].apply(lambda x: f"%{x*100:.1f}" if x > 0 else "%0.0")
            
            # Show last 30 days
            df_last_30 = df_full.tail(30).iloc[::-1] # latest first
            
            st.dataframe(
                df_last_30,
                column_config={
                    "Gün Başı Kasa (TL)": st.column_config.NumberColumn(format="%.2f TL"),
                    "Giren Para (TL)": st.column_config.NumberColumn(format="%.2f TL"),
                    "Çıkan Para (TL)": st.column_config.NumberColumn(format="%.2f TL"),
                    "Vadesiz Bakiye (TL)": st.column_config.NumberColumn(format="%.2f TL"),
                    "Faiz İşleyen Matrah (TL)": st.column_config.NumberColumn(format="%.2f TL"),
                    "Net Faiz Getirisi (TL)": st.column_config.NumberColumn(format="%.4f TL"),
                    "Gün Sonu Kasa (TL)": st.column_config.NumberColumn(format="%.2f TL"),
                },
                hide_index=True,
                use_container_width=True
            )
