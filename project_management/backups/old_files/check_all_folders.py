#!/usr/bin/env python3
import imaplib
import ssl

# Connect
mail = imaplib.IMAP4_SSL('imapn2.mymailsystem.com', 993, ssl_context=ssl.create_default_context())
mail.login('rohan.seth@openripplestudio.info', 'lnfkG$4!MFPH')

# Get all folders
status, folders = mail.list()
print('ALL FOLDERS:')
for folder in folders:
    folder_name = folder.decode('utf-8')
    print(f'  {folder_name}')
    
    # Try to get folder name only
    parts = folder_name.split(' "/" ')
    if len(parts) > 1:
        clean_name = parts[-1].strip('"')
        print(f'    Clean name: {clean_name}')

mail.logout() 