with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix inject_custom_css header
bad_head = """def inject_custom_css()

# Authentication Check
if not check_password():
    st.stop():
    st.markdown(\"\"\""""

good_head = """def inject_custom_css():
    st.markdown(\"\"\""""

content = content.replace(bad_head, good_head)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed inject_custom_css syntax!")
