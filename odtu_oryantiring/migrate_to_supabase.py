import sqlite3
import requests
import os
import sys

# Configure stdout encoding to prevent Windows console encoding errors
sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = 'ekonomi.db'

print("--- ODTÜ Oryantiring Finans Takip - Supabase Veri Göçü (Migration) Aracı ---")
print("Bu araç, bilgisayarınızdaki yerel verileri Supabase bulut veri tabanınıza kopyalayacaktır.\n")

# Read from env or prompt
SUPABASE_URL = os.environ.get("SUPABASE_URL") or input("Supabase URL: ").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or input("Supabase API Key (anon/service_role key): ").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Hata: Supabase URL ve Key bilgileri zorunludur!")
    exit(1)

# Remove trailing slash
SUPABASE_URL = SUPABASE_URL.rstrip('/')

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def migrate_table(table_name):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"Hata: Yerel {table_name} tablosu okunamadı. ({e})")
        conn.close()
        return
    conn.close()
    
    if not rows:
        print(f"Yerel {table_name} tablosu boş veya veri içermiyor, geçiliyor.")
        return
        
    print(f"\n{table_name} tablosundaki {len(rows)} kayıt buluta kopyalanıyor...")
    
    # Bulk insert via PostgREST
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table_name}", headers=headers, json=rows)
    if r.status_code in [200, 201]:
        print(f"✓ {table_name} tablosu başarıyla kopyalandı!")
    else:
        print(f"✗ {table_name} kopyalanırken hata oluştu: {r.status_code} - {r.text}")

# Migrate tables in dependency order
migrate_table("categories")
migrate_table("debts")
migrate_table("transactions")
migrate_table("interest_rate_logs")

print("\n==============================================================================")
print("Göç işlemi tamamlandı!")
print("Lütfen Supabase panelinizdeki SQL Editor kısmına giderek aşağıdaki kodları yapıştırıp çalıştırın.")
print("Bu kodlar, otomatik artan ID dizilerini güncelleyerek gelecekte çakışma yaşanmasını engeller:")
print("------------------------------------------------------------------------------")
print("""
SELECT setval(pg_get_serial_sequence('categories', 'id'), coalesce(max(id), 0) + 1, false) FROM categories;
SELECT setval(pg_get_serial_sequence('debts', 'id'), coalesce(max(id), 0) + 1, false) FROM debts;
SELECT setval(pg_get_serial_sequence('transactions', 'id'), coalesce(max(id), 0) + 1, false) FROM transactions;
SELECT setval(pg_get_serial_sequence('interest_rate_logs', 'id'), coalesce(max(id), 0) + 1, false) FROM interest_rate_logs;
""")
print("==============================================================================")
