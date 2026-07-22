with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Define check_password function
check_password_func = '''def check_password():
    """Returns `True` if the user has entered the correct password."""
    if st.session_state.get("authenticated", False):
        return True

    if st.query_params.get("auth") == "oryantiring":
        st.session_state["authenticated"] = True
        return True

    st.markdown("""
        <style>
        .login-card-container {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: 40px;
            margin-bottom: 20px;
        }
        .login-card {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            padding: 35px 30px 25px 30px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            text-align: center;
        }
        .login-badge {
            display: inline-block;
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            font-size: 12px;
            font-weight: 700;
            padding: 5px 14px;
            border-radius: 20px;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 15px;
        }
        .login-title {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        .login-subtitle {
            color: #94a3b8;
            font-size: 14px;
            margin-bottom: 20px;
            line-height: 1.5;
        }
        </style>
    """, unsafe_allow_html=True)

    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("""
            <div class="login-card-container">
                <div class="login-card">
                    <div class="login-badge">🧭 ODTÜ Oryantiring</div>
                    <div class="login-title">Finans Takip Portalı</div>
                    <div class="login-subtitle">Devam etmek için lütfen giriş şifresini girin.</div>
                </div>
            </div>
        """, unsafe_allow_html=True)

        with st.form("login_form", clear_on_submit=False):
            password = st.text_input("🔑 Giriş Şifresi", type="password", placeholder="Şifrenizi girin...", key="login_pwd_input")
            remember_me = st.checkbox("📌 Beni Hatırla", value=True, help="Bu cihazda tekrar şifre sormasın.")
            submit_btn = st.form_submit_button("🔒 Giriş Yap", use_container_width=True, type="primary")

            if submit_btn:
                if password.strip().lower() == "oryantiring":
                    st.session_state["authenticated"] = True
                    if remember_me:
                        st.query_params["auth"] = "oryantiring"
                    else:
                        if "auth" in st.query_params:
                            del st.query_params["auth"]
                    st.success("✅ Giriş başarılı!")
                    st.rerun()
                else:
                    st.error("❌ Hatalı şifre! Lütfen tekrar deneyin.")

    return False

'''

# Insert check_password definition before INITIALIZE APP
target_init = "# --- INITIALIZE APP ---"
content = content.replace(target_init, check_password_func + "\n" + target_init)

# Insert auth check call after inject_custom_css()
target_css = "inject_custom_css()"
replacement_css = """inject_custom_css()

# Authentication Check
if not check_password():
    st.stop()"""
content = content.replace(target_css, replacement_css)

# Insert Logout button in sidebar
target_sidebar_info = """st.sidebar.info(
    "💡 **ON Hesap Faiz Kuralı:**\\n"
    "Kasadaki paranın Burgan ON limitlerine göre belirlenen 'vadesiz bakiye' kısmı faizden muaftır. Aşan tutar günlük bileşik faiz ile nemalandırılır. Faiz kazançlarından %17.5 stopaj vergisi kesilmektedir."
)"""

replacement_sidebar_info = """st.sidebar.info(
    "💡 **ON Hesap Faiz Kuralı:**\\n"
    "Kasadaki paranın Burgan ON limitlerine göre belirlenen 'vadesiz bakiye' kısmı faizden muaftır. Aşan tutar günlük bileşik faiz ile nemalandırılır. Faiz kazançlarından %17.5 stopaj vergisi kesilmektedir."
)

st.sidebar.markdown("---")
if st.sidebar.button("🚪 Çıkış Yap", use_container_width=True):
    st.session_state["authenticated"] = False
    if "auth" in st.query_params:
        del st.query_params["auth"]
    st.rerun()"""

content = content.replace(target_sidebar_info, replacement_sidebar_info)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Login screen added to app.py successfully!")
