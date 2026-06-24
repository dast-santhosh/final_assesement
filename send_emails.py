import csv
import os
import smtplib
import time
import getpass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from string import Template

# HTML Template using placeholders for student scores & details
HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Final Assessment Results - DevShaala</title>
</head>
<body style="margin: 0; padding: 0; background-color: #e0e7ff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333333;">

    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #e0e7ff; padding: 40px 10px;">
        <tr>
            <td align="center">
                <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; max-width: 600px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                    
                    <tr>
                        <td align="center" style="padding: 25px 20px; background-color: #ffffff; border-bottom: 2px solid #f3f4f6;">
                            <img src="https://i.ibb.co/d0MkQ4t6/Dev-Shaala-Logo.png" alt="DevShaala Logo" style="max-height: 55px; display: block; margin-bottom: 10px;">
                            <p style="margin: 0; font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">
                                <span style="color: #1e3a8a;">from DEVSHAALA</span> 
                                <span style="color: #9ca3af; font-weight: normal; margin: 0 5px;">~</span> 
                                <span style="color: #10b981;">under GTC</span>
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td>
                            <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Python MasterClass" style="width: 100%; max-height: 200px; object-fit: cover; display: block;">
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin-top: 0; color: #1e3a8a; font-size: 24px; text-align: center;">Python Masterclass Assessment</h2>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">Hi <strong>$NAME</strong>,</p>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">Congratulations on successfully completing your <strong>Final Exam</strong>! Below is a detailed breakdown of your performance, reviewed by your mentor.</p>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">Please enter the following 16-digit passcode on the results portal to decrypt and download your official completion certificate:</p>
                            <div style="text-align: center; margin: 20px 0;">
                                <span style="color: #ef4444; font-family: monospace; font-size: 20px; font-weight: bold; background: #fee2e2; padding: 10px 20px; border-radius: 6px; border: 1px dashed #fca5a5; display: inline-block; letter-spacing: 1px;">$PASSCODE</span>
                            </div>

                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0; background-color: #f8fafc; border: 2px solid #bfdbfe; border-radius: 10px; overflow: hidden;">
                                <tr>
                                    <td align="center" style="background-color: #1e3a8a; padding: 20px; color: #ffffff;">
                                        <p style="margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #93c5fd;">Total Score</p>
                                        <h1 style="margin: 5px 0 0 0; font-size: 48px;">$TOTAL</h1>
                                        <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #10b981;">Grade: $GRADE</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 20px 30px;">
                                        <table width="100%" border="0" cellspacing="0" cellpadding="10" style="font-size: 15px;">
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Section A: MCQ Questionnaire</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$QUESTIONAIRRE</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Section B: Core Programs</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$PROGRAM</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Section C: Systems Scenario (Long Code)</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$PRESENTATION</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Section D: Theoretical Answers</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$EXPLANATION</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563;">Overall Impression</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold;">$OVERALL</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px 20px; margin-bottom: 30px;">
                                <p style="margin: 0; color: #065f46; font-size: 15px; font-style: italic;">
                                    <strong>Mentor's Remark:</strong> "$REMARKS"
                                </p>
                            </div>

                            <hr style="border: none; border-top: 1px dashed #cbd5e1; margin: 30px 0;">

                            <p style="font-size: 14px; font-weight: bold; color: #1e3a8a; margin-bottom: 10px;">Message summary for your records:</p>
                            
                            <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px;">
                                <p style="font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.6; color: #334155; margin: 0;">
                                    Name: $NAME<br>
                                    Batch Name: Python Masterclass Assessment<br>
                                    Exam Name: Final Theory & Practical Exam<br>
                                    --------------------------------------<br>
                                    MCQ Questionnaire: $QUESTIONAIRRE<br>
                                    Core Programs    : $PROGRAM<br>
                                    Systems Scenario : $PRESENTATION<br>
                                    Theory Answers   : $EXPLANATION<br>
                                    Overall          : $OVERALL<br>
                                    --------------------------------------<br>
                                    Total Marks      : $TOTAL<br>
                                    Grade            : $GRADE<br>
                                    Decryption Key   : $PASSCODE<br>
                                    Remarks          : $REMARKS<br>
                                    <br>
                                    Best Regards,<br>
                                    SANTHOSH<br>
                                    Mentor, DEVSHAALA
                                </p>
                            </div>
                            
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="background-color: #1e3a8a; padding: 20px; color: #bfdbfe; font-size: 12px;">
                            <p style="margin: 0;">© 2026 DevShaala under GTC. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
                <div style="height: 40px;"></div>
            </td>
        </tr>
    </table>

</body>
</html>"""


def generate_and_send_emails(csv_filename):
    """
    Reads the student data from the CSV, generates HTML emails, and sends them via SMTP.
    """
    output_dir = "Generated_Emails"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    template = Template(HTML_TEMPLATE)
    
    print("\n=== DevShaala Final Exam Email Dispatcher ===")
    print("Note: If using Gmail, you MUST use a 16-letter 'App Password' without spaces.")
    sender_email = input("Enter your sender email (e.g. devshaala@gmail.com): ").strip()
    password = getpass.getpass("Enter your App Password (typing will be hidden): ").replace(" ", "")
    
    try:
        print("Connecting to email server...")
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, password)
        print("✅ Login successful! Starting email dispatch...\n")
    except Exception as e:
        print(f"❌ Failed to login. Please check credentials.")
        print(f"Error details: {e}")
        return

    try:
        with open(csv_filename, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            for row in reader:
                name = row.get("NAME", "Student").strip()
                recipient_email = row.get("EMAIL", "").strip()
                
                # Render HTML by substituting placeholders with CSV row data
                personalized_html = template.safe_substitute(
                    NAME=name,
                    PROGRAM=f"{row.get('PROGRAM', '0').strip()}/9.0",
                    PRESENTATION=f"{row.get('PRESENTATION', '0').strip()}/6.0",
                    EXPLANATION=f"{row.get('EXPLANATION', '0').strip()}/5.0",
                    QUESTIONAIRRE=f"{row.get('QUESTIONAIRRE', '0').strip()}/10.0",
                    OVERALL=row.get("OVERALL", "Needs Improvement").strip(),
                    TOTAL=f"{row.get('TOTAL', '0').strip()}/30.0",
                    GRADE=row.get("Grade", "F").strip(),
                    REMARKS=row.get("Remarks", "").strip(),
                    PASSCODE=row.get("PASSCODE", "").strip()
                )
                
                # Save local backup
                safe_name = "".join(x for x in name if x.isalnum() or x in " -_").replace(" ", "_")
                output_filename = os.path.join(output_dir, f"{safe_name}_results.html")
                with open(output_filename, 'w', encoding='utf-8') as html_file:
                    html_file.write(personalized_html)
                
                # Send the email
                if recipient_email:
                    msg = MIMEMultipart("alternative")
                    msg['Subject'] = f"DevShaala Python Masterclass Exam Results - {name}"
                    msg['From'] = f"Santhosh - DevShaala <{sender_email}>"
                    msg['To'] = recipient_email
                    
                    msg.attach(MIMEText(personalized_html, "html"))
                    
                    try:
                        server.sendmail(sender_email, recipient_email, msg.as_string())
                        print(f"📧 Sent successfully to: {name} ({recipient_email})")
                        time.sleep(1) # prevent rate limiting
                    except Exception as e:
                        print(f"❌ Failed to send to {name}: {e}")
                else:
                    print(f"⚠️ No email address found for {name}, saved local file only.")
                    
        print("\n🎉 Email dispatch completed successfully!")

    except FileNotFoundError:
        print(f"Error: Could not find '{csv_filename}'. Make sure it's in the same folder.")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        try:
            server.quit()
        except:
            pass

if __name__ == "__main__":
    generate_and_send_emails("USERS FINAL PROJECT.csv")
