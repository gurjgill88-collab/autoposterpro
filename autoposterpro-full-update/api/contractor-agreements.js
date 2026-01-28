// api/contractor-agreements.js
// Independent Contractor / Sales Representative Agreements

import { kv } from '../lib/redis.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.autoposterpro.com';

// Agreement Templates
const CONTRACTOR_TEMPLATES = {
  CA: generateCanadaAgreement,
  US: generateUSAAgreement
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // Verify admin access for all operations
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Decode and verify admin role
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (!['super_admin', 'admin'].includes(payload.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
  } catch (e) {
    // Allow if it's the admin secret key
    if (token !== process.env.ADMIN_SECRET_KEY) {
      return res.status(401).json({ error: 'Invalid token or admin access required' });
    }
  }
  
  try {
    // GET - List contractor agreements or get specific one
    if (req.method === 'GET') {
      const { id, preview } = req.query;
      
      // Preview agreement template
      if (preview) {
        const data = JSON.parse(preview);
        const template = CONTRACTOR_TEMPLATES[data.country] || CONTRACTOR_TEMPLATES.CA;
        return res.status(200).json({ 
          content: template(data),
          country: data.country
        });
      }
      
      // Get specific agreement
      if (id) {
        const agreement = await kv.get(id);
        if (!agreement) return res.status(404).json({ error: 'Agreement not found' });
        return res.status(200).json({ agreement });
      }
      
      // List all contractor agreements
      const agreementIds = await kv.lrange('contractor-agreements', 0, -1) || [];
      const agreements = [];
      
      for (const agId of agreementIds) {
        const ag = await kv.get(agId);
        if (ag) agreements.push(ag);
      }
      
      agreements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return res.status(200).json({ agreements });
    }
    
    // POST - Create and send contractor agreement
    if (req.method === 'POST') {
      const data = req.body;
      
      if (!data.contractorName || !data.contractorEmail) {
        return res.status(400).json({ error: 'Contractor name and email required' });
      }
      
      const agreementId = `contractor:${Date.now()}`;
      const signatureToken = generateToken();
      
      const template = CONTRACTOR_TEMPLATES[data.country] || CONTRACTOR_TEMPLATES.CA;
      
      const agreement = {
        id: agreementId,
        type: 'contractor',
        
        // Contractor Info
        contractorName: data.contractorName,
        contractorEmail: data.contractorEmail,
        contractorPhone: data.contractorPhone || '',
        contractorAddress: data.contractorAddress || '',
        contractorCity: data.contractorCity || '',
        contractorProvince: data.contractorProvince || '',
        contractorPostalCode: data.contractorPostalCode || '',
        country: data.country || 'CA',
        
        // Position Details
        position: data.position || 'Field Sales Representative',
        territory: data.territory || 'Assigned Territory',
        startDate: data.startDate || new Date().toISOString().split('T')[0],
        probationDays: data.probationDays || 90,
        
        // Compensation
        commissionRate: data.commissionRate || 50,
        paymentDay: data.paymentDay || 15,
        
        // Custom Terms
        customTerms: data.customTerms || '',
        
        // Agreement Content (generated)
        content: template(data),
        
        // Status
        status: 'pending', // pending, viewed, contractor_signed, company_signed, active, terminated
        signatureToken,
        signatureUrl: `${BASE_URL}/contractor-sign/${agreementId}?token=${signatureToken}`,
        
        // Timestamps
        createdAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        
        // Signatures
        viewCount: 0,
        lastViewedAt: null,
        contractorSignedAt: null,
        contractorSignatureData: null,
        companySignedAt: null,
        companySignatureData: null
      };
      
      await kv.set(agreementId, agreement);
      await kv.lpush('contractor-agreements', agreementId);
      
      // Send email
      try {
        await resend.emails.send({
          from: 'AutoPosterPro <hr@autoposterpro.com>',
          to: data.contractorEmail,
          subject: `Independent Contractor Agreement - AutoPosterPro`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #7c3aed; margin: 0;">AutoPosterPro</h1>
              </div>
              
              <h2>Independent Contractor Agreement</h2>
              <p>Hi ${data.contractorName},</p>
              <p>We're excited to move forward with you as an Independent Contractor / Field Sales Representative for AutoPosterPro.</p>
              <p>Please review and sign the attached agreement at your earliest convenience.</p>
              
              <div style="background: #f8f4ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #7c3aed;">Agreement Summary</h3>
                <p><strong>Position:</strong> ${agreement.position}</p>
                <p><strong>Type:</strong> Independent Contractor (1099/${data.country === 'CA' ? 'T4A' : '1099'})</p>
                <p><strong>Compensation:</strong> ${agreement.commissionRate}% of setup fees collected</p>
                <p><strong>Payment Schedule:</strong> ${agreement.paymentDay}th of the following month</p>
                <p><strong>Probation Period:</strong> ${agreement.probationDays} days</p>
              </div>
              
              <p style="margin: 30px 0; text-align: center;">
                <a href="${agreement.signatureUrl}" 
                   style="background: #7c3aed; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Review & Sign Agreement
                </a>
              </p>
              
              <p style="color: #666; font-size: 14px;">This agreement will expire on ${new Date(agreement.expiresAt).toLocaleDateString()}.</p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #888; font-size: 12px;">1553048 B.C. Ltd. dba AutoPosterPro | <a href="${BASE_URL}">autoposterpro.com</a> | support@autoposterpro.com</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Failed to send contractor agreement email:', emailError);
      }
      
      return res.status(201).json({ 
        success: true, 
        agreement,
        signatureUrl: agreement.signatureUrl
      });
    }
    
    // PUT - Sign agreement
    if (req.method === 'PUT') {
      const { id, action, signature, signerName, signerTitle } = req.body;
      
      const agreement = await kv.get(id);
      if (!agreement) {
        return res.status(404).json({ error: 'Agreement not found' });
      }
      
      if (action === 'company_sign') {
        // Company counter-signature (admin only - already verified above)
        if (agreement.status !== 'contractor_signed') {
          return res.status(400).json({ error: 'Contractor must sign first' });
        }
        
        agreement.status = 'active';
        agreement.companySignedAt = new Date().toISOString();
        agreement.companySignatureData = {
          signature,
          signerName,
          signerTitle: signerTitle || 'Authorized Representative',
          signedAt: new Date().toISOString()
        };
        
        await kv.set(id, agreement);
        
        // Send fully executed agreement
        try {
          await resend.emails.send({
            from: 'AutoPosterPro <hr@autoposterpro.com>',
            to: agreement.contractorEmail,
            subject: `Contractor Agreement Fully Executed - Welcome to AutoPosterPro!`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #22c55e;">Welcome to the Team!</h2>
                <p>Hi ${agreement.contractorName},</p>
                <p>Your Independent Contractor Agreement has been fully executed. You are now officially part of the AutoPosterPro sales team!</p>
                
                <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                  <h3 style="margin-top: 0;">Next Steps</h3>
                  <ul>
                    <li>You'll receive your sales training materials shortly</li>
                    <li>Your territory information will be provided</li>
                    <li>Access credentials for the sales portal will be sent separately</li>
                  </ul>
                </div>
                
                <p>Welcome aboard!</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #888; font-size: 12px;">AutoPosterPro Inc.</p>
              </div>
            `
          });
        } catch (e) {
          console.error('Failed to send welcome email:', e);
        }
        
        return res.status(200).json({ success: true, agreement });
      }
      
      // Void/Terminate action
      if (action === 'void' || action === 'terminate') {
        const { reason } = req.body;
        
        agreement.status = action === 'void' ? 'voided' : 'terminated';
        agreement.terminatedAt = new Date().toISOString();
        agreement.terminatedBy = 'admin';
        agreement.terminationReason = reason || (action === 'void' ? 'Voided by administrator' : 'Terminated by administrator');
        
        await kv.set(id, agreement);
        
        // Notify contractor
        try {
          await resend.emails.send({
            from: 'AutoPosterPro <hr@autoposterpro.com>',
            to: agreement.contractorEmail,
            subject: `Contractor Agreement ${action === 'void' ? 'Voided' : 'Terminated'} - AutoPosterPro`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ef4444;">Contractor Agreement ${action === 'void' ? 'Voided' : 'Terminated'}</h2>
                <p>Hi ${agreement.contractorName},</p>
                <p>Your Independent Contractor Agreement with AutoPosterPro has been ${action === 'void' ? 'voided' : 'terminated'}.</p>
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                <p>As a reminder, the following obligations continue to apply as per your agreement:</p>
                <ul>
                  <li>Confidentiality (6 years)</li>
                  <li>Non-solicitation of customers (6 years)</li>
                  <li>Non-competition (2 years)</li>
                  <li>Return of all Company property and materials</li>
                </ul>
                <p>If you have any questions, please contact hr@autoposterpro.com.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #888; font-size: 12px;">1553048 B.C. Ltd. dba AutoPosterPro | support@autoposterpro.com</p>
              </div>
            `
          });
        } catch (e) {
          console.error('Failed to send termination email:', e);
        }
        
        return res.status(200).json({ success: true, agreement });
      }
      
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Contractor agreements API error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ==================== CANADA AGREEMENT ====================
function generateCanadaAgreement(data) {
  const effectiveDate = data.startDate || new Date().toISOString().split('T')[0];
  const commissionRate = data.commissionRate || 50;
  const probationDays = data.probationDays || 90;
  const paymentDay = data.paymentDay || 15;
  
  return `
INDEPENDENT CONTRACTOR AGREEMENT
(Canada - Governed by the Laws of British Columbia)

This Independent Contractor Agreement ("Agreement") is made and entered into as of ${effectiveDate} ("Effective Date") by and between:

1553048 B.C. LTD. dba AutoPosterPro, a corporation incorporated under the laws of British Columbia, Canada ("Company")

AND

${data.contractorName || '[CONTRACTOR NAME]'}
${data.contractorAddress ? data.contractorAddress + ', ' : ''}${data.contractorCity || ''}, ${data.contractorProvince || ''} ${data.contractorPostalCode || ''}
Email: ${data.contractorEmail || '[EMAIL]'}
Phone: ${data.contractorPhone || '[PHONE]'}
("Contractor")

RECITALS

WHEREAS, the Company is engaged in the business of providing software solutions for automotive dealerships, including the AutoPosterPro software extension for vehicle listing automation;

WHEREAS, the Contractor desires to provide sales and business development services to the Company as an independent contractor, and the Company desires to engage the Contractor on the terms and conditions set forth herein;

NOW, THEREFORE, in consideration of the mutual covenants and agreements herein contained, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:

1. ENGAGEMENT AND RELATIONSHIP

1.1 Independent Contractor Status. The Company hereby engages the Contractor, and the Contractor hereby accepts engagement, as an independent contractor to perform the Services (as defined below). The Contractor acknowledges and agrees that:

(a) The Contractor is not an employee of the Company and nothing in this Agreement shall be construed to create an employer-employee relationship, partnership, joint venture, or agency relationship between the parties;

(b) The Contractor shall not be entitled to any employee benefits, including but not limited to vacation pay, holiday pay, sick leave, health insurance, pension contributions, workers' compensation, employment insurance, or any other benefits provided to employees of the Company;

(c) The Contractor is solely responsible for all income taxes, Canada Pension Plan (CPP) contributions, Employment Insurance (EI) premiums, GST/HST, and any other taxes, levies, or charges applicable to amounts paid to the Contractor under this Agreement;

(d) The Company will not withhold any taxes from payments to the Contractor and will issue a T4A slip for all payments made during the calendar year.

1.2 Position and Territory. The Contractor shall serve as a Field Sales Representative for the Company, responsible for:

(a) Prospecting and identifying potential customers within the assigned territory: ${data.territory || 'To be assigned'};
(b) Presenting and demonstrating the Company's software solutions to potential customers;
(c) Negotiating and closing sales contracts in accordance with Company pricing and policies;
(d) Maintaining accurate records of all sales activities and customer interactions;
(e) Meeting sales targets and performance metrics as established by the Company.

2. TERM AND PROBATION

2.1 Term. This Agreement shall commence on the Effective Date and shall continue until terminated by either party in accordance with Section 10 of this Agreement.

2.2 Probationary Period. The first ${probationDays} days of engagement shall constitute a probationary period ("Probationary Period") during which:

(a) Either party may terminate this Agreement at any time, with or without cause, upon 7 days' written notice;
(b) The Company will evaluate the Contractor's performance, suitability, and fit with Company culture;
(c) Commission rates and territory may be adjusted based on performance.

3. COMPENSATION

3.1 Commission Structure. The Contractor shall be compensated on a 100% commission basis as follows:

(a) Setup Fee Commission: ${commissionRate}% of all setup fees actually collected from customers acquired by the Contractor;
(b) No commission shall be earned on monthly subscription fees unless otherwise agreed in writing;
(c) Commission is earned only upon actual receipt of payment by the Company.

3.2 Payment Terms.

(a) Commissions shall be calculated and paid on the ${paymentDay}th day of the month following the month in which payment was received by the Company;
(b) The Company shall provide a commission statement detailing all calculations;
(c) Payment shall be made via electronic funds transfer to the account designated by the Contractor;
(d) The Contractor shall be responsible for providing accurate banking information and shall bear all costs associated with receiving payment.

3.3 Chargebacks. If a customer cancels, obtains a refund, or disputes a charge within 90 days of the initial sale, the corresponding commission may be deducted from future payments or recovered from the Contractor.

3.4 No Additional Compensation. The Contractor shall not be entitled to any additional compensation, bonuses, draws, advances, or reimbursements unless expressly agreed in writing by an authorized officer of the Company.

4. EXPENSES AND EQUIPMENT

4.1 Expenses. The Contractor is solely responsible for all costs and expenses incurred in connection with the performance of Services, including but not limited to:

(a) Travel, transportation, meals, and accommodation;
(b) Office space, utilities, and supplies;
(c) Telephone, internet, and communication expenses;
(d) Marketing materials not provided by the Company;
(e) Professional development and training beyond what the Company provides;
(f) Insurance, including but not limited to liability, vehicle, and health insurance.

4.2 Technology and Equipment. The Contractor is solely responsible for:

(a) Providing and maintaining all technology, hardware, software, and equipment necessary to perform the Services;
(b) Ensuring all technology used meets minimum security standards as specified by the Company;
(c) Any costs associated with computer equipment, mobile devices, and internet connectivity;
(d) Protecting Company data accessed through Contractor's devices.

5. CONFIDENTIAL INFORMATION

5.1 Definition. "Confidential Information" means any and all information, data, materials, and knowledge disclosed by the Company to the Contractor, or otherwise obtained by the Contractor in connection with this Agreement, whether in oral, written, graphic, electronic, or any other form, including but not limited to:

(a) Customer lists, databases, contact information, and customer data;
(b) Pricing information, discount structures, and sales strategies;
(c) Software source code, algorithms, technical specifications, and system architecture;
(d) Business plans, marketing strategies, and financial information;
(e) Trade secrets, know-how, and proprietary methodologies;
(f) Employee and contractor information;
(g) Any information marked or identified as confidential or proprietary.

5.2 Obligations. The Contractor agrees to:

(a) Hold all Confidential Information in strict confidence;
(b) Not disclose any Confidential Information to any third party without prior written consent of the Company;
(c) Use Confidential Information solely for the purpose of performing Services under this Agreement;
(d) Not copy, reproduce, photograph, print, or otherwise duplicate any Confidential Information, including customer lists, except as expressly authorized;
(e) Immediately notify the Company of any unauthorized disclosure or use of Confidential Information;
(f) Return or destroy all Confidential Information upon termination of this Agreement.

5.3 Duration. The obligations under this Section 5 shall survive termination of this Agreement and continue for a period of SIX (6) YEARS from the date of termination.

6. INTELLECTUAL PROPERTY

6.1 Company Ownership. The Contractor acknowledges and agrees that:

(a) All intellectual property rights in the Company's software, including but not limited to source code, object code, algorithms, user interfaces, documentation, and any modifications or enhancements, are and shall remain the exclusive property of the Company;
(b) Any works, inventions, or improvements created by the Contractor in connection with the Services shall be the sole and exclusive property of the Company;
(c) The Contractor hereby assigns to the Company all rights, title, and interest in any such works, inventions, or improvements.

6.2 Restrictions. The Contractor shall NOT:

(a) Copy, modify, adapt, translate, reverse engineer, decompile, or disassemble any Company software or technology;
(b) Attempt to derive source code, algorithms, or data structures from any Company products;
(c) Remove, alter, or obscure any proprietary notices or labels;
(d) Use Company intellectual property for any purpose other than performing Services;
(e) Develop, design, or create any product or service that competes with or replicates the Company's offerings.

7. NON-SOLICITATION AND NON-COMPETITION

7.1 Non-Solicitation of Customers. During the term of this Agreement and for a period of SIX (6) YEARS following termination, the Contractor shall NOT, directly or indirectly:

(a) Solicit, contact, or do business with any customer or prospective customer of the Company;
(b) Attempt to divert, take away, or interfere with any of the Company's customers or business relationships;
(c) Use any customer lists, contact information, or Confidential Information to compete with the Company;
(d) Assist any third party in soliciting or doing business with Company customers.

7.2 Non-Solicitation of Personnel. During the term of this Agreement and for a period of TWO (2) YEARS following termination, the Contractor shall NOT, directly or indirectly, solicit, recruit, or hire any employee or contractor of the Company.

7.3 Non-Competition. During the term of this Agreement and for a period of TWO (2) YEARS following termination, the Contractor shall NOT, directly or indirectly:

(a) Engage in any business that directly competes with the Company's software products and services;
(b) Develop, market, or sell any software or service that is substantially similar to the Company's offerings;
(c) Work for, consult with, or provide services to any direct competitor of the Company in the automotive software industry.

7.4 Reasonableness. The Contractor acknowledges that the restrictions in this Section 7 are reasonable and necessary to protect the Company's legitimate business interests, including its Confidential Information, customer relationships, and goodwill.

8. DATA PROTECTION AND PRIVACY

8.1 Compliance. The Contractor shall comply with all applicable privacy laws, including the Personal Information Protection and Electronic Documents Act (PIPEDA) and any provincial privacy legislation.

8.2 Data Security. The Contractor shall:

(a) Implement appropriate technical and organizational measures to protect personal data;
(b) Not process personal data except as necessary for the Services;
(c) Immediately notify the Company of any data breach or security incident;
(d) Not transfer personal data outside of Canada without prior written consent.

9. INDEMNIFICATION AND LIMITATION OF LIABILITY

9.1 Contractor Indemnification. THE CONTRACTOR SHALL INDEMNIFY, DEFEND, AND HOLD HARMLESS THE COMPANY, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES FROM AND AGAINST ANY AND ALL CLAIMS, DAMAGES, LOSSES, COSTS, AND EXPENSES (INCLUDING REASONABLE LEGAL FEES) ARISING OUT OF OR RELATED TO:

(a) The Contractor's performance of Services or conduct in connection with this Agreement;
(b) Any breach of this Agreement by the Contractor;
(c) Any negligent, reckless, or intentional misconduct by the Contractor;
(d) Any violation of applicable laws or regulations by the Contractor;
(e) Any misrepresentation made by the Contractor to customers or third parties;
(f) Any claims by third parties arising from the Contractor's actions or omissions.

9.2 Company Not Liable. THE COMPANY SHALL NOT BE LIABLE FOR ANY ACTIONS, OMISSIONS, REPRESENTATIONS, OR CONDUCT OF THE CONTRACTOR. THE CONTRACTOR ACKNOWLEDGES THAT THEY ACT INDEPENDENTLY AND NOT AS AN AGENT OF THE COMPANY EXCEPT AS EXPRESSLY AUTHORIZED IN WRITING.

9.3 Limitation of Liability. IN NO EVENT SHALL THE COMPANY'S TOTAL LIABILITY TO THE CONTRACTOR UNDER THIS AGREEMENT EXCEED THE TOTAL COMMISSIONS PAID TO THE CONTRACTOR IN THE SIX (6) MONTHS PRECEDING THE CLAIM.

9.4 No Consequential Damages. IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS OR BUSINESS OPPORTUNITIES.

10. TERMINATION

10.1 Termination for Convenience. Either party may terminate this Agreement at any time by providing 30 days' written notice to the other party (or 7 days during the Probationary Period).

10.2 Termination for Cause. The Company may terminate this Agreement immediately upon written notice if the Contractor:

(a) Breaches any material term of this Agreement;
(b) Engages in fraud, dishonesty, or misconduct;
(c) Violates any applicable law or regulation;
(d) Fails to meet performance standards after written warning;
(e) Takes any action that damages the Company's reputation or business.

10.3 Effect of Termination. Upon termination:

(a) All rights and licenses granted hereunder shall immediately terminate;
(b) The Contractor shall immediately cease representing themselves as affiliated with the Company;
(c) The Contractor shall return all Company property, materials, and Confidential Information;
(d) The Contractor shall be entitled to commission only on sales completed and payments collected prior to termination;
(e) The obligations under Sections 5, 6, 7, 8, and 9 shall survive termination.

11. REPRESENTATIONS AND WARRANTIES

11.1 Contractor Representations. The Contractor represents and warrants that:

(a) They have the legal right and authority to enter into this Agreement;
(b) They are not bound by any agreement that would prevent them from performing the Services;
(c) They will comply with all applicable laws and regulations;
(d) They will not make any false or misleading representations to customers;
(e) They have not been convicted of any crime involving fraud, dishonesty, or breach of trust.

12. GENERAL PROVISIONS

12.1 Entire Agreement. This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements and understandings.

12.2 Amendment. This Agreement may only be amended in writing signed by both parties.

12.3 Severability. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.

12.4 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the Province of Ontario and the federal laws of Canada applicable therein.

12.5 Dispute Resolution. Any dispute arising out of this Agreement shall be resolved by binding arbitration in accordance with the Arbitration Act (Ontario), to be held in Toronto, Ontario.

12.6 Notices. All notices shall be in writing and sent to the addresses set forth above.

12.7 Assignment. The Contractor may not assign this Agreement without the prior written consent of the Company.

12.8 Waiver. Failure to enforce any provision shall not constitute a waiver of future enforcement.

${data.customTerms ? `
13. ADDITIONAL TERMS

${data.customTerms}
` : ''}

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

1553048 B.C. LTD. dba AutoPosterPro

_________________________________
Name: ___________________________
Title: Authorized Representative
Date: ___________________________


CONTRACTOR

_________________________________
${data.contractorName || '[CONTRACTOR NAME]'}
Date: ___________________________

`;
}

// ==================== USA AGREEMENT ====================
function generateUSAAgreement(data) {
  const effectiveDate = data.startDate || new Date().toISOString().split('T')[0];
  const commissionRate = data.commissionRate || 50;
  const probationDays = data.probationDays || 90;
  const paymentDay = data.paymentDay || 15;
  
  return `
INDEPENDENT CONTRACTOR AGREEMENT
(United States - Governed by the Laws of Delaware)

This Independent Contractor Agreement ("Agreement") is made and entered into as of ${effectiveDate} ("Effective Date") by and between:

1553048 B.C. LTD. dba AutoPosterPro, a Canadian corporation ("Company")

AND

${data.contractorName || '[CONTRACTOR NAME]'}
${data.contractorAddress ? data.contractorAddress + ', ' : ''}${data.contractorCity || ''}, ${data.contractorProvince || ''} ${data.contractorPostalCode || ''}
Email: ${data.contractorEmail || '[EMAIL]'}
Phone: ${data.contractorPhone || '[PHONE]'}
("Contractor")

RECITALS

WHEREAS, the Company is engaged in the business of providing software solutions for automotive dealerships, including the AutoPosterPro software extension for vehicle listing automation;

WHEREAS, the Contractor desires to provide sales and business development services to the Company as an independent contractor, and the Company desires to engage the Contractor on the terms and conditions set forth herein;

NOW, THEREFORE, in consideration of the mutual covenants and agreements herein contained, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:

1. ENGAGEMENT AND RELATIONSHIP

1.1 Independent Contractor Status. The Company hereby engages the Contractor, and the Contractor hereby accepts engagement, as an independent contractor to perform the Services (as defined below). The Contractor acknowledges and agrees that:

(a) THE CONTRACTOR IS NOT AN EMPLOYEE OF THE COMPANY. Nothing in this Agreement shall be construed to create an employer-employee relationship, partnership, joint venture, or agency relationship between the parties;

(b) The Contractor shall not be entitled to any employee benefits, including but not limited to health insurance, retirement benefits, paid time off, workers' compensation, unemployment insurance, or any other benefits provided to employees;

(c) The Contractor is solely responsible for all federal, state, and local income taxes, self-employment taxes, Social Security and Medicare taxes, and any other taxes applicable to amounts paid under this Agreement;

(d) The Company will not withhold any taxes from payments to the Contractor. The Company will issue a Form 1099-NEC for all payments exceeding $600 in a calendar year;

(e) The Contractor shall complete and submit IRS Form W-9 prior to receiving any payment.

1.2 Position and Territory. The Contractor shall serve as a Field Sales Representative for the Company, responsible for:

(a) Prospecting and identifying potential customers within the assigned territory: ${data.territory || 'To be assigned'};
(b) Presenting and demonstrating the Company's software solutions to potential customers;
(c) Negotiating and closing sales contracts in accordance with Company pricing and policies;
(d) Maintaining accurate records of all sales activities and customer interactions;
(e) Meeting sales targets and performance metrics as established by the Company.

2. TERM AND PROBATION

2.1 Term. This Agreement shall commence on the Effective Date and shall continue until terminated by either party in accordance with Section 10 of this Agreement.

2.2 Probationary Period. The first ${probationDays} days of engagement shall constitute a probationary period ("Probationary Period") during which:

(a) Either party may terminate this Agreement at any time, with or without cause, upon 7 days' written notice;
(b) The Company will evaluate the Contractor's performance, suitability, and fit with Company culture;
(c) Commission rates and territory may be adjusted based on performance.

3. COMPENSATION

3.1 Commission Structure. The Contractor shall be compensated on a 100% commission basis as follows:

(a) Setup Fee Commission: ${commissionRate}% of all setup fees actually collected from customers acquired by the Contractor;
(b) No commission shall be earned on monthly subscription fees unless otherwise agreed in writing;
(c) Commission is earned only upon actual receipt of payment by the Company.

3.2 Payment Terms.

(a) Commissions shall be calculated and paid on the ${paymentDay}th day of the month following the month in which payment was received by the Company;
(b) The Company shall provide a commission statement detailing all calculations;
(c) Payment shall be made via ACH transfer to the account designated by the Contractor;
(d) The Contractor shall be responsible for providing accurate banking information.

3.3 Chargebacks. If a customer cancels, obtains a refund, or disputes a charge within 90 days of the initial sale, the corresponding commission may be deducted from future payments or recovered from the Contractor.

3.4 No Additional Compensation. The Contractor shall not be entitled to any additional compensation, bonuses, draws, advances, or reimbursements unless expressly agreed in writing by an authorized officer of the Company.

4. EXPENSES AND EQUIPMENT

4.1 Expenses. The Contractor is solely responsible for all costs and expenses incurred in connection with the performance of Services, including but not limited to:

(a) Travel, transportation, meals, and accommodation;
(b) Office space, utilities, and supplies;
(c) Telephone, internet, and communication expenses;
(d) Marketing materials not provided by the Company;
(e) Professional development and training beyond what the Company provides;
(f) Insurance, including but not limited to general liability, vehicle, and health insurance.

4.2 Technology and Equipment. The Contractor is solely responsible for:

(a) Providing and maintaining all technology, hardware, software, and equipment necessary to perform the Services;
(b) Ensuring all technology used meets minimum security standards as specified by the Company;
(c) Any costs associated with computer equipment, mobile devices, and internet connectivity;
(d) Protecting Company data accessed through Contractor's devices.

5. CONFIDENTIAL INFORMATION AND TRADE SECRETS

5.1 Definition. "Confidential Information" means any and all information, data, materials, and knowledge disclosed by the Company to the Contractor, or otherwise obtained by the Contractor in connection with this Agreement, whether in oral, written, graphic, electronic, or any other form, including but not limited to:

(a) Customer lists, databases, contact information, and customer data;
(b) Pricing information, discount structures, and sales strategies;
(c) Software source code, algorithms, technical specifications, and system architecture;
(d) Business plans, marketing strategies, and financial information;
(e) Trade secrets, know-how, and proprietary methodologies;
(f) Employee and contractor information;
(g) Any information marked or identified as confidential or proprietary.

5.2 Trade Secrets. The Contractor acknowledges that certain Confidential Information constitutes trade secrets under the Defend Trade Secrets Act of 2016 (DTSA) and applicable state law. Misappropriation of trade secrets may result in civil and criminal liability.

5.3 Obligations. The Contractor agrees to:

(a) Hold all Confidential Information in strict confidence;
(b) Not disclose any Confidential Information to any third party without prior written consent of the Company;
(c) Use Confidential Information solely for the purpose of performing Services under this Agreement;
(d) NOT COPY, REPRODUCE, PHOTOGRAPH, PRINT, SCREENSHOT, OR OTHERWISE DUPLICATE ANY CONFIDENTIAL INFORMATION, INCLUDING CUSTOMER LISTS, EXCEPT AS EXPRESSLY AUTHORIZED;
(e) Immediately notify the Company of any unauthorized disclosure or use of Confidential Information;
(f) Return or destroy all Confidential Information upon termination of this Agreement.

5.4 Duration. The obligations under this Section 5 shall survive termination of this Agreement and continue for a period of SIX (6) YEARS from the date of termination, or indefinitely for trade secrets to the extent they remain protected under applicable law.

5.5 DTSA Notice. Pursuant to 18 U.S.C. § 1833(b), the Contractor is hereby notified that an individual shall not be held criminally or civilly liable under any federal or state trade secret law for the disclosure of a trade secret that is made in confidence to a government official or attorney solely for the purpose of reporting or investigating a suspected violation of law, or in a complaint or other document filed in a lawsuit if such filing is made under seal.

6. INTELLECTUAL PROPERTY

6.1 Company Ownership. The Contractor acknowledges and agrees that:

(a) All intellectual property rights in the Company's software, including but not limited to source code, object code, algorithms, user interfaces, documentation, patents, copyrights, and trademarks, are and shall remain the exclusive property of the Company;
(b) Any works, inventions, discoveries, or improvements created by the Contractor in connection with the Services shall be "work made for hire" to the extent permitted by law, and shall be the sole and exclusive property of the Company;
(c) To the extent any work is not considered work made for hire, the Contractor hereby irrevocably assigns to the Company all rights, title, and interest in such work.

6.2 Restrictions. The Contractor shall NOT:

(a) Copy, modify, adapt, translate, reverse engineer, decompile, or disassemble any Company software or technology;
(b) Attempt to derive source code, algorithms, or data structures from any Company products;
(c) Remove, alter, or obscure any proprietary notices or labels;
(d) Use Company intellectual property for any purpose other than performing Services;
(e) Develop, design, or create any product or service that competes with or replicates the Company's offerings.

7. NON-SOLICITATION AND NON-COMPETITION

7.1 Non-Solicitation of Customers. During the term of this Agreement and for a period of SIX (6) YEARS following termination, the Contractor shall NOT, directly or indirectly:

(a) Solicit, contact, or do business with any customer or prospective customer of the Company with whom the Contractor had contact or about whom the Contractor received Confidential Information;
(b) Attempt to divert, take away, or interfere with any of the Company's customers or business relationships;
(c) Use any customer lists, contact information, or Confidential Information to compete with the Company;
(d) Assist any third party in soliciting or doing business with Company customers.

7.2 Non-Solicitation of Personnel. During the term of this Agreement and for a period of TWO (2) YEARS following termination, the Contractor shall NOT, directly or indirectly, solicit, recruit, or hire any employee or contractor of the Company.

7.3 Non-Competition. During the term of this Agreement and for a period of TWO (2) YEARS following termination, the Contractor shall NOT, directly or indirectly:

(a) Engage in any business that directly competes with the Company's software products and services within the United States;
(b) Develop, market, or sell any software or service that is substantially similar to the Company's offerings;
(c) Work for, consult with, or provide services to any direct competitor of the Company in the automotive software industry.

7.4 Reasonableness. The Contractor acknowledges that the restrictions in this Section 7 are reasonable and necessary to protect the Company's legitimate business interests, including its Confidential Information, trade secrets, customer relationships, and goodwill. The Contractor further acknowledges that they have received adequate consideration for these restrictions.

8. DATA PROTECTION AND PRIVACY

8.1 Compliance. The Contractor shall comply with all applicable privacy laws, including the California Consumer Privacy Act (CCPA), and any other state or federal privacy regulations.

8.2 Data Security. The Contractor shall:

(a) Implement appropriate technical and organizational measures to protect personal data;
(b) Not process personal data except as necessary for the Services;
(c) Immediately notify the Company of any data breach or security incident;
(d) Not transfer personal data outside the United States without prior written consent.

9. INDEMNIFICATION AND LIMITATION OF LIABILITY

9.1 Contractor Indemnification. THE CONTRACTOR SHALL INDEMNIFY, DEFEND, AND HOLD HARMLESS THE COMPANY, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SHAREHOLDERS, AND AFFILIATES FROM AND AGAINST ANY AND ALL CLAIMS, DAMAGES, LOSSES, LIABILITIES, COSTS, AND EXPENSES (INCLUDING REASONABLE ATTORNEYS' FEES AND COSTS OF LITIGATION) ARISING OUT OF OR RELATED TO:

(a) The Contractor's performance of Services or conduct in connection with this Agreement;
(b) Any breach of this Agreement by the Contractor;
(c) Any negligent, reckless, or intentional misconduct by the Contractor;
(d) Any violation of applicable laws or regulations by the Contractor;
(e) Any misrepresentation made by the Contractor to customers or third parties;
(f) Any claims by third parties arising from the Contractor's actions or omissions;
(g) Any tax liability arising from the Contractor's status as an independent contractor.

9.2 Company Not Liable. THE COMPANY SHALL NOT BE LIABLE FOR ANY ACTIONS, OMISSIONS, REPRESENTATIONS, WARRANTIES, OR CONDUCT OF THE CONTRACTOR. THE CONTRACTOR ACKNOWLEDGES THAT THEY ACT INDEPENDENTLY AND NOT AS AN AGENT OF THE COMPANY EXCEPT AS EXPRESSLY AUTHORIZED IN WRITING. THE CONTRACTOR SHALL NOT HAVE THE AUTHORITY TO BIND THE COMPANY TO ANY CONTRACT, OBLIGATION, OR LIABILITY.

9.3 Limitation of Liability. IN NO EVENT SHALL THE COMPANY'S TOTAL LIABILITY TO THE CONTRACTOR UNDER THIS AGREEMENT EXCEED THE TOTAL COMMISSIONS PAID TO THE CONTRACTOR IN THE SIX (6) MONTHS PRECEDING THE CLAIM.

9.4 No Consequential Damages. IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, REVENUE, BUSINESS OPPORTUNITIES, OR GOODWILL, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

10. TERMINATION

10.1 At-Will Termination. Either party may terminate this Agreement at any time, with or without cause, by providing 30 days' written notice to the other party (or 7 days during the Probationary Period).

10.2 Termination for Cause. The Company may terminate this Agreement immediately upon written notice if the Contractor:

(a) Breaches any material term of this Agreement;
(b) Engages in fraud, dishonesty, theft, or misconduct;
(c) Violates any applicable law or regulation;
(d) Fails to meet performance standards after written warning;
(e) Takes any action that damages the Company's reputation or business;
(f) Misappropriates any Confidential Information or trade secrets.

10.3 Effect of Termination. Upon termination:

(a) All rights and licenses granted hereunder shall immediately terminate;
(b) The Contractor shall immediately cease representing themselves as affiliated with the Company;
(c) The Contractor shall return all Company property, materials, and Confidential Information within 5 business days;
(d) The Contractor shall be entitled to commission only on sales completed and payments collected prior to termination;
(e) The obligations under Sections 5, 6, 7, 8, and 9 shall survive termination.

11. DISPUTE RESOLUTION

11.1 Arbitration. Any dispute, claim, or controversy arising out of or relating to this Agreement shall be resolved by binding arbitration administered by the American Arbitration Association in accordance with its Commercial Arbitration Rules.

11.2 Location. The arbitration shall be conducted in Wilmington, Delaware.

11.3 Waiver of Jury Trial. THE PARTIES HEREBY WAIVE ANY RIGHT TO A JURY TRIAL IN CONNECTION WITH ANY DISPUTE ARISING UNDER THIS AGREEMENT.

11.4 Class Action Waiver. THE PARTIES AGREE TO RESOLVE DISPUTES ONLY ON AN INDIVIDUAL BASIS AND WAIVE ANY RIGHT TO BRING OR PARTICIPATE IN ANY CLASS ACTION, COLLECTIVE ACTION, OR REPRESENTATIVE ACTION.

11.5 Injunctive Relief. Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent irreparable harm pending arbitration.

12. REPRESENTATIONS AND WARRANTIES

12.1 Contractor Representations. The Contractor represents and warrants that:

(a) They have the legal right and authority to enter into this Agreement;
(b) They are not bound by any agreement that would prevent them from performing the Services;
(c) They will comply with all applicable laws and regulations;
(d) They will not make any false or misleading representations to customers;
(e) They have not been convicted of any crime involving fraud, dishonesty, or breach of trust;
(f) They are authorized to work in the United States.

13. GENERAL PROVISIONS

13.1 Entire Agreement. This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements, understandings, and negotiations.

13.2 Amendment. This Agreement may only be amended in writing signed by both parties.

13.3 Severability. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect. If any restriction is found to be unreasonable or unenforceable, it shall be modified to the minimum extent necessary to make it enforceable.

13.4 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.

13.5 Notices. All notices shall be in writing and sent to the addresses set forth above, or to such other address as a party may designate in writing.

13.6 Assignment. The Contractor may not assign this Agreement without the prior written consent of the Company. The Company may assign this Agreement in connection with a merger, acquisition, or sale of substantially all of its assets.

13.7 Waiver. Failure to enforce any provision shall not constitute a waiver of future enforcement.

13.8 Counterparts. This Agreement may be executed in counterparts, each of which shall be deemed an original.

${data.customTerms ? `
14. ADDITIONAL TERMS

${data.customTerms}
` : ''}

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

1553048 B.C. LTD. dba AutoPosterPro

_________________________________
Name: ___________________________
Title: Authorized Representative
Date: ___________________________


CONTRACTOR

_________________________________
${data.contractorName || '[CONTRACTOR NAME]'}
Date: ___________________________

`;
}
