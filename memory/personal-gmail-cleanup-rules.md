# Personal Gmail cleanup rules (kravch@gmail.com)

Source: user-provided previous summary (2026-01-28).

Context: Gmail category:promotions contains some non-promo transactional and account/security emails. Blind trashing by category+age is unsafe.

## Classification

### TRASH (almost always)
- Has List-Unsubscribe AND subject/sender clearly marketing (sale/discount/angebote/newsletter/digest/promo, etc)
- Or obvious marketing sender AND no transactional/account/security signals

### KEEP (do not touch)
If subject contains any of:
- Account/security: registration, login, verify, OTP, code, security, password
- Orders/shipping: order, bestellung, lieferung, shipment, tracking, delivery
- Payments/docs: invoice, receipt, rechnung, payment, zahlung, refund, return
- Invites/activation: invite, інвайт, activation, активація
Also keep if sender/domain is a delivery/payment provider (DHL/DPD/UPS/FedEx, PayPal, Google/Apple, etc).

### UNCLEAR (handle cautiously)
- terms/policy update, membership changes, etc

## Languages
Rules should cover English, German, Ukrainian, Russian keywords.

## Default approach
Safest: move only TRASH candidates to Trash; leave KEEP and UNCLEAR.
