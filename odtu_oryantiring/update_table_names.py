with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    'client._get("categories"': 'client._get("ory_categories"',
    'client._insert("categories"': 'client._insert("ory_categories"',
    'client._delete("categories"': 'client._delete("ory_categories"',
    'client._update("categories"': 'client._update("ory_categories"',
    
    'client._get("transactions"': 'client._get("ory_transactions"',
    'client._insert("transactions"': 'client._insert("ory_transactions"',
    'client._delete("transactions"': 'client._delete("ory_transactions"',
    'client._update("transactions"': 'client._update("ory_transactions"',
    
    'client._get("debts"': 'client._get("ory_debts"',
    'client._insert("debts"': 'client._insert("ory_debts"',
    'client._delete("debts"': 'client._delete("ory_debts"',
    'client._update("debts"': 'client._update("ory_debts"',
    
    'client._get("interest_rate_logs"': 'client._get("ory_interest_rate_logs"',
    'client._insert("interest_rate_logs"': 'client._insert("ory_interest_rate_logs"',
    'client._delete("interest_rate_logs"': 'client._delete("ory_interest_rate_logs"',
    'client._update("interest_rate_logs"': 'client._update("ory_interest_rate_logs"'
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Table names updated in app.py successfully!")
