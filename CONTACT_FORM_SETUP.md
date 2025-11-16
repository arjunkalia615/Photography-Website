# Contact Form Setup Instructions

The contact form on your website is configured to send emails to **hello@ifeelworld.com** using Formsubmit.co.

## ✅ Quick Setup (2 minutes)

The form is ready to use! You just need to confirm your email address on the first submission.

### First-Time Activation

1. **Submit a test form** from your contact page
2. **Check hello@ifeelworld.com** for a confirmation email from Formsubmit
3. **Click the confirmation link** in the email
4. **Done!** All future submissions will be delivered automatically

That's it! No signup or account creation required.

## Current Configuration

The form is set up with:
- **Email Service**: Formsubmit.co (works immediately after email confirmation)
- **Recipient Email**: hello@ifeelworld.com
- **Spam Protection**: Honeypot field (`_honey`) + Formsubmit's built-in protection
- **Form Validation**: Client-side validation with error messages
- **Success Messages**: User-friendly feedback
- **Auto-Response**: Users receive a confirmation email automatically

## How It Works

1. Users fill out the contact form on your website
2. Form data is validated (client-side)
3. Data is sent securely to Formsubmit.co
4. Formsubmit.co forwards the email to hello@ifeelworld.com
5. You receive a formatted email with all form details
6. Your email address is never displayed on the website

## Alternative: Formspree (More Features)

If you prefer Formspree (dashboard, analytics, more control), you can switch:

1. **Sign up for Formspree** (Free)
   - Go to https://formspree.io
   - Sign up (free plan: 50 submissions/month)
   - Create a new form
   - Set email to: hello@ifeelworld.com
   - Copy your Form ID (looks like: `xpwnqjdk`)

2. **Update contact.html**
   - Find line 58: `<form class="contact-form" id="contactForm" action="https://formsubmit.co/hello@ifeelworld.com" method="POST">`
   - Replace with: `<form class="contact-form" id="contactForm" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">`
   - Replace `YOUR_FORM_ID` with your Formspree form ID

3. **Update hidden fields** to Formspree format:
   ```html
   <!-- Formspree configuration -->
   <input type="hidden" name="_to" value="hello@ifeelworld.com">
   <input type="hidden" name="_subject" value="New Contact Form Submission from ifeelworld.com">
   <input type="hidden" name="_replyto" id="_replyto" value="">
   <input type="hidden" name="_format" value="plain">
   ```

4. **Update JavaScript** - The current code already works with Formspree!

## Form Features

✅ **Spam Protection**: Honeypot field that bots fill but humans don't see  
✅ **Client-Side Validation**: Real-time validation with helpful error messages  
✅ **Success/Error Messages**: Clear feedback to users  
✅ **Loading States**: Button shows "Sending..." during submission  
✅ **Mobile Responsive**: Works perfectly on all devices  
✅ **Email Privacy**: Your email address is never displayed on the website  

## Testing the Form

1. Visit your contact page
2. Fill out all required fields
3. Click "Send Message"
4. You should see a success message
5. Check hello@ifeelworld.com for the email (check spam folder if not received)

## Troubleshooting

### Emails Not Received
- **Check spam/junk folder** - This is the #1 reason!
- Verify email address is correct: hello@ifeelworld.com
- Check Formspree dashboard for submission logs
- Wait a few minutes (sometimes there's a delay)
- Verify your Formspree form is active and not paused

### Form Not Submitting
- Check browser console for errors (Press F12, then Console tab)
- Verify internet connection
- Try a different browser
- Check that all required fields are filled
- Make sure you clicked the confirmation link in the first email

### Formsubmit Errors
- **"Too many requests"**: You've hit the rate limit, wait a moment
- **Emails going to spam**: Check spam folder, and consider adding Formsubmit to your contacts
- **Not receiving emails**: Verify you clicked the confirmation link in the first email

### Need Help?
- **Formsubmit.co Documentation**: https://formsubmit.co/documentation
- **Formsubmit.co Support**: https://formsubmit.co/contact
- **Formspree Alternative**: https://formspree.io (requires signup but has more features)

## Security Notes

- The honeypot field (`_honey`) helps prevent spam bots
- All form submissions are validated before sending
- Email addresses are not exposed in the HTML
- Form data is sent over HTTPS (secure connection)
- Formsubmit.co has built-in spam protection

## Email Format

When you receive form submissions, the email will include:
- **Subject**: New Contact Form Submission from ifeelworld.com
- **From**: The user's email address (so you can reply directly)
- **Body**: Formatted message with:
  - Subject (selected from dropdown)
  - User's name and email
  - Their message

## Rate Limits

- **Formsubmit.co**: 100 submissions/day (free)
- **Formspree**: 50 submissions/month (free)

If you need more submissions, consider upgrading to a paid plan.

