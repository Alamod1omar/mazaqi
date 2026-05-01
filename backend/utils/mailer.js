const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendOTP = async (email, otp) => {
    const mailOptions = {
        from: `"بوفية مذاقي" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'رمز التحقق الخاص بك - بوفية مذاقي',
        html: `
            <div style="font-family: Arial, sans-serif; direction: rtl; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #964900;">مرحباً بك في بوفية مذاقي</h2>
                <p>شكراً لتسجيلك معنا. يرجى استخدام الرمز التالي لتفعيل حسابك:</p>
                <div style="background-color: #f4faff; padding: 15px; border-radius: 8px; display: inline-block; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #964900;">${otp}</span>
                </div>
                <p style="color: #666; font-size: 14px;">هذا الرمز صالح لمدة 10 دقائق.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">إذا لم تقم بطلب هذا الرمز، يرجى تجاهل هذا البريد الإلكتروني.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

const sendWelcomeEmail = async (email, name) => {
    const mailOptions = {
        from: `"بوفية مذاقي" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'تم تفعيل حسابك بنجاح! - بوفية مذاقي',
        html: `
            <div style="font-family: Arial, sans-serif; direction: rtl; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #964900;">أهلاً بك يا ${name}!</h2>
                <p>لقد تم تفعيل حسابك بنجاح في بوفية مذاقي.</p>
                <p>يمكنك الآن البدء بطلب وجباتك المفضلة والاستمتاع بعروضنا الحصرية.</p>
                <div style="margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login.html" 
                       style="background-color: #964900; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        ابدأ الآن
                    </a>
                </div>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #999;">شكراً لاختيارك بوفية مذاقي.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Welcome email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        return false;
    }
};

const sendOrderConfirmation = async (email, orderDetails) => {
    const { orderId, items, subtotal, delivery_fee, total, customer_name, created_at } = orderDetails;
    
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product_name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: left;">${item.price} ر.س</td>
        </tr>
    `).join('');

    const mailOptions = {
        from: `"بوفية مذاقي" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `تأكيد طلبك رقم #${orderId} - بوفية مذاقي`,
        html: `
            <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
                <h2 style="color: #964900; text-align: center;">شكراً لطلبك من بوفية مذاقي!</h2>
                <p>مرحباً ${customer_name}،</p>
                <p>لقد استلمنا طلبك بنجاح وهو الآن قيد المعالجة.</p>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #333;">تفاصيل الطلب #${orderId}</h3>
                    <p style="font-size: 14px; color: #666;">التاريخ: ${new Date(created_at || Date.now()).toLocaleString('ar-SA')}</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                        <thead>
                            <tr style="background-color: #eee;">
                                <th style="padding: 10px; text-align: right;">المنتج</th>
                                <th style="padding: 10px; text-align: center;">الكمية</th>
                                <th style="padding: 10px; text-align: left;">السعر</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                    
                    <div style="text-align: left; font-weight: bold;">
                        <p>المجموع الفرعي: ${subtotal} ر.س</p>
                        <p>رسوم التوصيل: ${delivery_fee} ر.س</p>
                        <p style="font-size: 18px; color: #964900;">الإجمالي: ${total} ر.س</p>
                    </div>
                </div>
                
                <p style="text-align: center; color: #666; font-size: 14px;">سنقوم بإشعارك عند تحديث حالة طلبك.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #999; text-align: center;">شكراً لاختيارك بوفية مذاقي.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Order confirmation sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending order email:', error);
        return false;
    }
};

module.exports = { sendOTP, sendWelcomeEmail, sendOrderConfirmation };
