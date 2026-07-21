with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace 1: Supabase transactions select
old_1 = 'tx_data = client._get("ory_transactions", params={"select": "id,date,category_id,amount,description", "order": "date.asc,id.asc"})'
new_1 = 'tx_data = client._get("ory_transactions", params={"select": "id,date,category_id,amount,description,time_range", "order": "date.asc,id.asc"})'
content = content.replace(old_1, new_1)

# Replace 2: SQLite transactions select
old_2 = """        # Fetch transactions
        cursor.execute(\"\"\"
            SELECT id, date, category_id, amount, description
            FROM transactions
            ORDER BY date ASC, id ASC
        \"\"\")"""
new_2 = """        # Fetch transactions
        cursor.execute(\"\"\"
            SELECT id, date, category_id, amount, description, time_range
            FROM transactions
            ORDER BY date ASC, id ASC
        \"\"\")"""
content = content.replace(old_2, new_2)

# Replace 3: Loop body
old_3 = """        # 1. Morning Posting (05:00) on Business Days
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
        accumulated_gross += gross_raw"""

new_3 = """        # 1. Morning Posting (05:00) on Business Days
        posted_interest = 0.0
        vault_before_posting = current_vault
        if not is_weekend and accumulated_gross > 0.0:
            posted_gross = math.floor((accumulated_gross + 1e-9) * 100) / 100
            posted_stopaj = math.floor((posted_gross * 0.175 + 1e-9) * 100) / 100
            posted_interest = math.floor((posted_gross - posted_stopaj + 1e-9) * 100) / 100
            current_vault += posted_interest
            total_interest_earned += posted_interest
            accumulated_gross = 0.0
            
        # 2. Process DAY transactions (05:00 - 18:15)
        day_txs = []
        night_txs = []
        if curr in tx_by_date:
            for tx in tx_by_date[curr]:
                t_range = tx.get('time_range', '05:00 - 18:15')
                if t_range == '18:15 - 05:00':
                    night_txs.append(tx)
                else:
                    day_txs.append(tx)
                    
        for tx in day_txs:
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
                gross_truncated = math.floor((gross_raw + 1e-9) * 100) / 100
                stopaj_truncated = math.floor((gross_truncated * 0.175 + 1e-9) * 100) / 100
                daily_interest = math.floor((gross_truncated - stopaj_truncated + 1e-9) * 100) / 100
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
                gross_truncated = math.floor((gross_raw + 1e-9) * 100) / 100
                stopaj_truncated = math.floor((gross_truncated * 0.175 + 1e-9) * 100) / 100
                daily_interest = math.floor((gross_truncated - stopaj_truncated + 1e-9) * 100) / 100
            else:
                earning_base = 0.0
                daily_interest = 0.0
                
        # Accumulate this day's gross interest
        accumulated_gross += gross_raw
        
        # 4. Process NIGHT transactions (18:15 - 05:00)
        for tx in night_txs:
            if tx['cat_type'] == 'Gelir':
                current_vault += tx['amount']
                day_income += tx['amount']
            else:
                current_vault -= tx['amount']
                day_expense += tx['amount']"""

content = content.replace(old_3, new_3)

# Replace 4: Pending interest calculation epsilon fix
old_4 = """    # Pending interest calculation
    pending_net = 0.0
    if accumulated_gross > 0.0:
        pending_gross = math.floor(accumulated_gross * 100) / 100
        pending_stopaj = math.floor(pending_gross * 0.175 * 100) / 100
        pending_net = math.floor((pending_gross - pending_stopaj) * 100) / 100"""

new_4 = """    # Pending interest calculation
    pending_net = 0.0
    if accumulated_gross > 0.0:
        pending_gross = math.floor((accumulated_gross + 1e-9) * 100) / 100
        pending_stopaj = math.floor((pending_gross * 0.175 + 1e-9) * 100) / 100
        pending_net = math.floor((pending_gross - pending_stopaj + 1e-9) * 100) / 100"""

content = content.replace(old_4, new_4)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Simulation logic fixes applied to app.py successfully!")
