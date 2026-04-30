@echo off
set /p msg="Nhap noi dung commit: "

git add .
git commit -m "%msg%"
git push origin main

echo ------------------------------
echo Da push len GitHub thanh cong!
pause