import csv
import smtplib
import os
from email.mime.text import MIMEText
from email.header import Header

# ================= 配置区域（仅需确认这1处）=================
# 固定读取正式客户文件：customers.csv（无需修改路径，和脚本同目录）
CSV_PATH ='sample-customers.csv' 

# SMTP 服务器配置 (无密码则仅生成内容，不发送)
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 465 
SENDER_EMAIL = 'your_name@example.com' # 你的发件箱
SENDER_PASSWORD = 'your_app_password'  # 你的应用专用密码
# ===========================================

def detect_language_by_domain(email):
    """保留Gemini核心：根据邮箱后缀精准识别语言"""
    ext = email.split('.')[-1].lower()
    mapping = {
        'cn': 'Chinese',
        'fr': 'French',
        'ca': 'French',
        'jp': 'Japanese',
        'de': 'German',
        'es': 'Spanish'
    }
    return mapping.get(ext, 'English') # 默认英语

def get_content(language):
    """保留Gemini原版邮件内容模板"""
    templates = {
        'English': {
            'sub': 'Business Cooperation Inquiry',
            'body': 'Hello,\n\nI found your website through your domain and would like to discuss potential cooperation.'
        },
        'French': {
            'sub': 'Demande de collaboration commerciale',
            'body': 'Bonjour,\n\nJ\'ai trouvé votre site via votre domaine et j\'aimerais discuter d\'une éventuelle collaboration.'
        },
        'Chinese': {
            'sub': '商务合作咨询',
            'body': '您好，\n\n我通过您的网站域名关注到了贵司，希望能探讨潜在的合作机会。'
        }
    }
    return templates.get(language, templates['English'])

def main():
    # 检查正式客户文件是否存在（不存在则提示）
    if not os.path.exists(CSV_PATH):
        print(f"错误：未找到正式客户文件 {CSV_PATH}，请确认文件已放在当前目录！")
        return

    try:
        # 适配：无SMTP密码时仅生成内容，不连接服务器
        if SENDER_PASSWORD != 'your_app_password':
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            print("SMTP 服务器连接成功，开始处理正式客户数据...")
        else:
            print("⚠️ 未配置SMTP密码，仅生成邮件内容（不发送）：")

        # 读取正式客户CSV（适配「网址」/「url」、「邮箱」/「email」列名）
        with open(CSV_PATH, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            # 新增language列（便于验证语言判断结果）
            rows = []
            fieldnames = reader.fieldnames
            if 'language' not in fieldnames:
                fieldnames.append('language')
            
            for row in reader:
                # 兼容正式CSV的列名：优先读取「网址」/「url」，「邮箱」/「email」
                url = row.get('网址') or row.get('url')
                email = row.get('邮箱') or row.get('email')

                if not email:
                    print(f"警告：某行数据无邮箱，跳过处理")
                    rows.append(row)
                    continue

                # 核心：基于邮箱后缀精准判断语言
                lang = detect_language_by_domain(email)
                row['language'] = lang  # 给该行添加语言标记
                rows.append(row)

                # 获取对应语言的邮件内容
                mail_data = get_content(lang)

                # 构建邮件（保留Gemini逻辑）
                msg = MIMEText(mail_data['body'], 'plain', 'utf-8')
                msg['Subject'] = Header(mail_data['sub'], 'utf-8')
                msg['From'] = SENDER_EMAIL
                msg['To'] = email

                # 发送邮件或打印内容
                if SENDER_PASSWORD != 'your_app_password':
                    try:
                        server.sendmail(SENDER_EMAIL, [email], msg.as_string())
                        print(f"✅ 已发送 [{lang}]: {email} (网址: {url})")
                    except Exception as e:
                        print(f"❌ 发送失败 {email}: {e}")
                else:
                    print(f"\n[{lang}] 给 {email} 的邮件（网址: {url}）：")
                    print(f"主题：{mail_data['sub']}")
                    print(f"内容：{mail_data['body']}")

        # 写入带language列的正式客户CSV（覆盖原文件，便于后续查看）
        with open(CSV_PATH, mode='w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"\n✅ 已处理完所有正式客户数据，新增language列到 {CSV_PATH}")

        # 关闭SMTP连接
        if SENDER_PASSWORD != 'your_app_password':
            server.quit()
        print("所有任务处理完毕！")

    except Exception as e:
        print(f"程序出错: {e}")

if __name__ == "__main__":
    main()
