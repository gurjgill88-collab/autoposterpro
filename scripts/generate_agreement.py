"""
AutoPosterPro - EULA/Agreement PDF Generator
Generates a pre-filled service agreement for dealer signature
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from datetime import datetime, timedelta
import json
import sys

# Brand colors
PURPLE = HexColor('#7c3aed')
ORANGE = HexColor('#f97316')
DARK = HexColor('#1a1425')

def generate_agreement_pdf(dealer_info, output_path):
    """
    Generate a service agreement PDF with dealer info pre-filled.
    
    dealer_info = {
        "dealer_name": "Vancouver Pre-Owned",
        "dealer_number": "12345",
        "contact_name": "John Smith",
        "contact_email": "john@dealership.com",
        "contact_phone": "(604) 555-1234",
        "address": "123 Main St, Vancouver, BC V6B 1A1",
        "plan": "monthly" or "annual",
        "price": "99.00",
        "start_date": "2026-01-26"  # Optional, defaults to today
    }
    """
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    styles.add(ParagraphStyle(
        name='Title2',
        parent=styles['Title'],
        fontSize=24,
        textColor=PURPLE,
        spaceAfter=20
    ))
    
    styles.add(ParagraphStyle(
        name='Heading2Custom',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=PURPLE,
        spaceBefore=20,
        spaceAfter=10
    ))
    
    styles.add(ParagraphStyle(
        name='BodyJustify',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        alignment=TA_JUSTIFY,
        spaceAfter=10
    ))
    
    styles.add(ParagraphStyle(
        name='BodyLeft',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        alignment=TA_LEFT,
        spaceAfter=6
    ))
    
    styles.add(ParagraphStyle(
        name='SmallItalic',
        parent=styles['Normal'],
        fontSize=9,
        textColor=HexColor('#666666'),
        fontName='Helvetica-Oblique'
    ))
    
    styles.add(ParagraphStyle(
        name='SignatureLine',
        parent=styles['Normal'],
        fontSize=10,
        spaceBefore=30
    ))
    
    story = []
    
    # Parse dates
    start_date = datetime.strptime(dealer_info.get('start_date', datetime.now().strftime('%Y-%m-%d')), '%Y-%m-%d')
    
    if dealer_info.get('plan') == 'annual':
        end_date = start_date + timedelta(days=365)
        term_text = "twelve (12) months"
        renewal_text = "This Agreement will automatically renew for successive one-year terms unless either party provides written notice of cancellation at least sixty (60) days prior to the end of the current term."
    else:
        end_date = start_date + timedelta(days=30)
        term_text = "month-to-month"
        renewal_text = "This Agreement will automatically renew on a month-to-month basis unless either party provides written notice of cancellation at least sixty (60) days prior to the desired termination date."
    
    price = dealer_info.get('price', '99.00')
    
    # === PAGE 1: HEADER AND PARTIES ===
    
    story.append(Paragraph("AUTOPOSTERPRO", styles['Title2']))
    story.append(Paragraph("Software License and Service Agreement", styles['Heading1']))
    story.append(Spacer(1, 20))
    
    # Agreement intro
    story.append(Paragraph(
        f"This Software License and Service Agreement (\"Agreement\") is entered into as of "
        f"<b>{start_date.strftime('%B %d, %Y')}</b> (\"Effective Date\") by and between:",
        styles['BodyJustify']
    ))
    story.append(Spacer(1, 15))
    
    # Parties table
    parties_data = [
        ["SERVICE PROVIDER:", "AutoPosterPro"],
        ["", "support@autoposterpro.com"],
        ["", ""],
        ["SUBSCRIBER:", dealer_info.get('dealer_name', '[DEALER NAME]')],
        ["Dealer #:", dealer_info.get('dealer_number', '[DEALER #]')],
        ["Contact:", dealer_info.get('contact_name', '[CONTACT NAME]')],
        ["Email:", dealer_info.get('contact_email', '[EMAIL]')],
        ["Phone:", dealer_info.get('contact_phone', '[PHONE]')],
        ["Address:", dealer_info.get('address', '[ADDRESS]')]
    ]
    
    parties_table = Table(parties_data, colWidths=[1.5*inch, 5*inch])
    parties_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(parties_table)
    story.append(Spacer(1, 20))
    
    # Recitals
    story.append(Paragraph("RECITALS", styles['Heading2Custom']))
    story.append(Paragraph(
        "WHEREAS, AutoPosterPro provides software tools designed to assist automotive dealerships "
        "in posting vehicle listings to online marketplaces; and",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "WHEREAS, Subscriber desires to obtain a license to use such software tools subject to "
        "the terms and conditions set forth herein;",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "NOW, THEREFORE, in consideration of the mutual covenants and agreements herein contained, "
        "the parties agree as follows:",
        styles['BodyJustify']
    ))
    
    # === SECTION 1: LICENSE GRANT ===
    story.append(Paragraph("1. LICENSE GRANT", styles['Heading2Custom']))
    story.append(Paragraph(
        "1.1 <b>Grant of License.</b> Subject to the terms of this Agreement and payment of all applicable fees, "
        "AutoPosterPro grants Subscriber a limited, non-exclusive, non-transferable, revocable license to use "
        "the AutoPosterPro Chrome extension and related services (\"Software\") for Subscriber's internal "
        "business purposes.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "1.2 <b>Single Device License.</b> This license permits installation and use of the Software on "
        "<b>one (1) device only</b>. The license key provided shall be bound to a single device upon activation. "
        "Additional devices require additional licenses.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "1.3 <b>Restrictions.</b> Subscriber shall not: (a) sublicense, sell, rent, lease, or transfer the Software; "
        "(b) reverse engineer, decompile, or disassemble the Software; (c) share license keys with third parties; "
        "(d) use the Software in violation of any applicable laws or third-party terms of service, including but "
        "not limited to Facebook's Terms of Service.",
        styles['BodyJustify']
    ))
    
    # === SECTION 2: TERM AND FEES ===
    story.append(Paragraph("2. TERM AND FEES", styles['Heading2Custom']))
    
    # Subscription details table
    sub_data = [
        ["Subscription Plan:", dealer_info.get('plan', 'monthly').capitalize()],
        ["Initial Term:", term_text],
        ["Monthly Fee:", f"CAD ${price}"],
        ["Start Date:", start_date.strftime('%B %d, %Y')],
    ]
    
    sub_table = Table(sub_data, colWidths=[2*inch, 4.5*inch])
    sub_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#f5f3ff')),
        ('BOX', (0, 0), (-1, -1), 1, PURPLE),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, HexColor('#e5e3f5')),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(sub_table)
    story.append(Spacer(1, 15))
    
    story.append(Paragraph(
        f"2.1 <b>Initial Term.</b> This Agreement shall commence on the Effective Date and continue for "
        f"an initial term of {term_text}.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        f"2.2 <b>Renewal.</b> {renewal_text}",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "2.3 <b>Payment.</b> Subscriber agrees to pay all fees when due. Fees are non-refundable except as "
        "required by law. AutoPosterPro reserves the right to suspend service for non-payment.",
        styles['BodyJustify']
    ))
    
    # === SECTION 3: CANCELLATION ===
    story.append(Paragraph("3. CANCELLATION POLICY", styles['Heading2Custom']))
    story.append(Paragraph(
        "3.1 <b>60-Day Notice Required.</b> Either party may cancel this Agreement by providing written notice "
        "to the other party at least <b>sixty (60) days</b> prior to the desired termination date. Cancellation "
        "notices must be sent to support@autoposterpro.com.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "3.2 <b>Effect of Cancellation.</b> Upon cancellation: (a) Subscriber's license to use the Software "
        "terminates immediately upon the cancellation effective date; (b) no refunds shall be issued for "
        "prepaid fees for the period following cancellation; (c) Subscriber shall cease all use of the Software.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "3.3 <b>Termination for Breach.</b> AutoPosterPro may terminate this Agreement immediately upon "
        "written notice if Subscriber breaches any material term of this Agreement.",
        styles['BodyJustify']
    ))
    
    # Page break
    story.append(PageBreak())
    
    # === PAGE 2 ===
    
    # === SECTION 4: DISCLAIMER ===
    story.append(Paragraph("4. DISCLAIMER OF WARRANTIES", styles['Heading2Custom']))
    story.append(Paragraph(
        "THE SOFTWARE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR "
        "IMPLIED. AUTOPOSTERPRO DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, "
        "FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. AUTOPOSTERPRO DOES NOT WARRANT THAT THE "
        "SOFTWARE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.",
        styles['BodyJustify']
    ))
    
    # === SECTION 5: LIMITATION OF LIABILITY ===
    story.append(Paragraph("5. LIMITATION OF LIABILITY", styles['Heading2Custom']))
    story.append(Paragraph(
        "IN NO EVENT SHALL AUTOPOSTERPRO BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, "
        "OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, OR GOODWILL, "
        "REGARDLESS OF THE CAUSE OF ACTION OR THE THEORY OF LIABILITY.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "AUTOPOSTERPRO'S TOTAL CUMULATIVE LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE TOTAL FEES "
        "PAID BY SUBSCRIBER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.",
        styles['BodyJustify']
    ))
    
    # === SECTION 6: THIRD PARTY SERVICES ===
    story.append(Paragraph("6. THIRD-PARTY SERVICES", styles['Heading2Custom']))
    story.append(Paragraph(
        "6.1 Subscriber acknowledges that the Software interacts with third-party services, including "
        "but not limited to Facebook Marketplace and Google AI services.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "6.2 Subscriber is solely responsible for compliance with all third-party terms of service. "
        "AutoPosterPro is not responsible for any actions taken by third parties against Subscriber's accounts, "
        "including account suspensions, restrictions, or terminations.",
        styles['BodyJustify']
    ))
    
    # === SECTION 7: PRIVACY ===
    story.append(Paragraph("7. PRIVACY AND DATA", styles['Heading2Custom']))
    story.append(Paragraph(
        "AutoPosterPro's collection and use of information is governed by our Privacy Policy, available at "
        "autoposterpro.com/privacy. Subscriber consents to such collection and use.",
        styles['BodyJustify']
    ))
    
    # === SECTION 8: INDEMNIFICATION ===
    story.append(Paragraph("8. INDEMNIFICATION", styles['Heading2Custom']))
    story.append(Paragraph(
        "Subscriber agrees to indemnify, defend, and hold harmless AutoPosterPro and its officers, directors, "
        "employees, and agents from any claims, damages, losses, liabilities, costs, and expenses (including "
        "reasonable attorneys' fees) arising from Subscriber's use of the Software or breach of this Agreement.",
        styles['BodyJustify']
    ))
    
    # === SECTION 9: GOVERNING LAW ===
    story.append(Paragraph("9. GOVERNING LAW AND JURISDICTION", styles['Heading2Custom']))
    story.append(Paragraph(
        "9.1 <b>For Canadian Subscribers:</b> This Agreement shall be governed by the laws of the Province of "
        "British Columbia, Canada, without regard to conflict of law principles. Any disputes shall be resolved "
        "in the courts of British Columbia.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "9.2 <b>For US Subscribers:</b> This Agreement shall be governed by the laws of the State of Delaware, "
        "USA. Any disputes shall be resolved through binding arbitration in accordance with the rules of the "
        "American Arbitration Association.",
        styles['BodyJustify']
    ))
    
    # === SECTION 10: GENERAL ===
    story.append(Paragraph("10. GENERAL PROVISIONS", styles['Heading2Custom']))
    story.append(Paragraph(
        "10.1 <b>Entire Agreement.</b> This Agreement constitutes the entire agreement between the parties and "
        "supersedes all prior negotiations, representations, or agreements relating to its subject matter.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "10.2 <b>Amendments.</b> This Agreement may only be amended in writing signed by both parties.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "10.3 <b>Severability.</b> If any provision is found unenforceable, the remaining provisions shall "
        "continue in full force and effect.",
        styles['BodyJustify']
    ))
    story.append(Paragraph(
        "10.4 <b>Assignment.</b> Subscriber may not assign this Agreement without AutoPosterPro's prior "
        "written consent.",
        styles['BodyJustify']
    ))
    
    # Page break for signatures
    story.append(PageBreak())
    
    # === PAGE 3: SIGNATURES ===
    
    story.append(Paragraph("SIGNATURES", styles['Heading2Custom']))
    story.append(Paragraph(
        "By signing below, the parties acknowledge that they have read, understood, and agree to be bound "
        "by the terms and conditions of this Agreement.",
        styles['BodyJustify']
    ))
    story.append(Spacer(1, 30))
    
    # Subscriber signature section
    story.append(Paragraph("<b>SUBSCRIBER:</b>", styles['BodyLeft']))
    story.append(Paragraph(dealer_info.get('dealer_name', '[DEALER NAME]'), styles['BodyLeft']))
    story.append(Spacer(1, 40))
    story.append(Paragraph("_" * 50, styles['SignatureLine']))
    story.append(Paragraph(f"Authorized Signature: {dealer_info.get('contact_name', '[CONTACT NAME]')}", styles['SmallItalic']))
    story.append(Spacer(1, 20))
    story.append(Paragraph("_" * 50, styles['SignatureLine']))
    story.append(Paragraph("Date", styles['SmallItalic']))
    
    story.append(Spacer(1, 50))
    
    # AutoPosterPro signature section
    story.append(Paragraph("<b>AUTOPOSTERPRO:</b>", styles['BodyLeft']))
    story.append(Spacer(1, 40))
    story.append(Paragraph("_" * 50, styles['SignatureLine']))
    story.append(Paragraph("Authorized Representative", styles['SmallItalic']))
    story.append(Spacer(1, 20))
    story.append(Paragraph("_" * 50, styles['SignatureLine']))
    story.append(Paragraph("Date", styles['SmallItalic']))
    
    story.append(Spacer(1, 50))
    
    # Contact info
    story.append(Paragraph(
        "<b>Questions about this Agreement?</b><br/>"
        "Contact us at support@autoposterpro.com",
        styles['SmallItalic']
    ))
    
    # Build PDF
    doc.build(story)
    print(f"Agreement PDF generated: {output_path}")


def main():
    # Example usage / test
    if len(sys.argv) > 1:
        # Load dealer info from JSON file
        with open(sys.argv[1], 'r') as f:
            dealer_info = json.load(f)
        output_path = sys.argv[2] if len(sys.argv) > 2 else 'agreement.pdf'
    else:
        # Demo data
        dealer_info = {
            "dealer_name": "Vancouver Pre-Owned Auto Sales",
            "dealer_number": "40289",
            "contact_name": "John Smith",
            "contact_email": "john@vancouverpreowned.com",
            "contact_phone": "(604) 555-1234",
            "address": "123 Main Street, Vancouver, BC V6B 1A1",
            "plan": "monthly",
            "price": "99.00",
            "start_date": "2026-01-26"
        }
        output_path = '/mnt/user-data/outputs/AutoPosterPro-Agreement-SAMPLE.pdf'
    
    generate_agreement_pdf(dealer_info, output_path)


if __name__ == "__main__":
    main()
