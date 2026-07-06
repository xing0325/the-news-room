@echo off
cd /d C:\Users\david\the-news-room
npx wrangler pages dev web/out --kv WORLD --binding SESSION_SECRET=devsecret --binding APP_PASSWORD_HASH=ef260e9aa3c673af240d17a2660480361a8e081d1ffeca2a5ed0e3219fc18567 --binding ADMIN_SECRET=devadmin --port 8788
