with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add CSS to hide sidebar when on login screen
old_style = """        .login-card-container {"""

new_style = """        /* Hide sidebar on login screen */
        [data-testid="stSidebar"] {
            display: none !important;
        }
        .login-card-container {"""

if old_style in content and "[data-testid=\"stSidebar\"]" not in content:
    content = content.replace(old_style, new_style)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated login screen CSS to hide sidebar when unauthenticated!")
