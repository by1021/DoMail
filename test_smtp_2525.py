#!/usr/bin/env python3
"""
DoMail SMTP 2525端口测试脚本 - 最简版本
"""

import smtplib
from email.mime.text import MIMEText
from datetime import datetime

# 配置
SMTP_HOST = 'localhost'
SMTP_PORT = 2525
FROM_ADDR = 'test@example.com'
TO_ADDR = 'mvsy47tuvi@7w0jmhf0.ziiy.eu.cc'  # 使用实际存在的邮箱

# 创建邮件
msg = MIMEText(f'测试邮件 - {datetime.now()}', 'plain', 'utf-8')
msg['From'] = FROM_ADDR
msg['To'] = TO_ADDR
msg['Subject'] = 'SMTP测试邮件'

# 发送
try:
    print(f'连接 {SMTP_HOST}:{SMTP_PORT}...')
    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    server.send_message(msg)
    server.quit()
    print('[OK] 发送成功！')
    print(f'收件人: {TO_ADDR}')
except Exception as e:
    print(f'[ERROR] 发送失败: {e}')