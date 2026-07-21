import sqlite3
import requests
import os
import sys

# Configure stdout encoding to prevent Windows console encoding errors
sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = 'ekonomi.db'
SUPABASE_URL = "https://cwuwhldshxeewcxrsysl.supabase.co"
SUPABASE_KEY = "sb_publishable_FbmEfk62usTmwQimQTModA_Yg3i9buT"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def migrate_table(sqlite_table, supabase_table, boolean_fields=None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute(f"SELECT * FROM {sqlite_table}")
        rows = [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Hata: Yerel {sqlite_table} tablosu okunamadı. ({e})")
        conn.close()
        return
    conn.close()
    
    if not rows:
        print(f"Yerel {sqlite_table} tablosu boş veya veri içermiyor, geçiliyor.")
        return
        
    # Explicitly cast boolean fields if necessary
    if boolean_fields:
        for row in rows:
            for field in boolean_fields:
                if field in row:
                    row[field] = bool(row[field])
                    
    print(f"\n{sqlite_table} -> {supabase_table} ({len(rows)} kayıt buluta kopyalanıyor...)")
    
    # Clean/Truncate the Supabase table first to avoid duplicate key conflicts
    requests.delete(f"{SUPABASE_URL}/rest/v1/{supabase_table}", headers=headers)
    
    # Bulk insert via PostgREST
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{supabase_table}", headers=headers, json=rows)
    if r.status_code in [200, 201]:
        print(f"✓ {supabase_table} başarıyla kopyalandı!")
    else:
        print(f"✗ {supabase_table} kopyalanırken hata oluştu: {r.status_code} - {r.text}")

print("--- ODTÜ Oryantiring Finans Takip - Supabase Veri Göçü Başlıyor ---")

# Migrate tables in dependency order
migrate_table("categories", "ory_categories")
migrate_table("debts", "ory_debts", boolean_fields=["is_active"])
migrate_table("transactions", "ory_transactions")
migrate_table("interest_rate_logs", "ory_interest_rate_logs")

print("\n==============================================================================")
print("Göç işlemi tamamlandı!")
print("==============================================================================")
