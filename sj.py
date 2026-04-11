import smtplib
from email.message import EmailMessage

msg = EmailMessage()
msg["Subject"] = "SMTP 收件测试"
msg["From"] = "hello@abc.com"
msg["To"] = "k1ap26rxpf@ziiy.eu.cc"
msg.set_content("这是一封通过 2525 端口投递的测试邮件。")

with smtplib.SMTP("127.0.0.1", 2525, timeout=10) as smtp:
    smtp.send_message(msg)

print("sent")