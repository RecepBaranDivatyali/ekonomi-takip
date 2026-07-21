with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = {
    'categories(name,emoji,color,type)': 'categories:ory_categories(name,emoji,color,type)',
    'categories(name,emoji,color)': 'categories:ory_categories(name,emoji,color)',
    'categories(type)': 'categories:ory_categories(type)'
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Aliased category joins updated successfully in app.py!")
