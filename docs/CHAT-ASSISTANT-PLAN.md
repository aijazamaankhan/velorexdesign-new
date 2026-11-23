# Chat assistant: plan

Status: proposed, not built (24 November 2026).

## Goal

Answer common questions on the site, show products, let customers check an order, and hand everything else to WhatsApp (+91 79060 27807), without adding running costs or slowing the site.

## Recommendation: our own assistant with fixed replies

A chat bubble at the bottom corner of every page. It replaces the floating WhatsApp button and keeps WhatsApp inside it. No AI, no third-party script.

### Quick-reply buttons

| Button | Behaviour |
| --- | --- |
| Browse products | Categories, then product cards (photo, name, Buy on Amazon / Order on WhatsApp) from the live catalogue |
| Find a product | Visitor types a word; the assistant searches the product list and shows matches |
| Vijaysar glass help | Fixed answers: how to use, first use, care, when to replace, "is it a medicine?" |
| Track my order | Order number + email or phone; shows status and tracking number only when both match |
| Shipping & returns | Short answers with links to the policy pages |
| How to buy | Amazon vs WhatsApp ordering |
| Talk to us | Opens WhatsApp with the chat so far pre-filled |
| Leave a message | Name, phone or email, message; saved and shown in admin |

### Understanding typed text

Keyword matching in English and common Hinglish, for example:

- price, cost, rate, kitna, kitne ka → How to buy
- deliver, shipping, courier, kab tak → Shipping
- return, refund, replace, wapas → Returns
- order, track, status, kahan hai → Track my order
- vijaysar, glass, sugar, diabetes → Vijaysar help (no medical claims: "traditional wellness product, not a medicine")

Unmatched text gets: "I'll connect you with us," with the WhatsApp and Leave a message buttons.

### Admin

- **Chat replies:** edit questions, keywords, answers and quick buttons (stored in the database, cached in the page).
- **Messages inbox:** messages left in chat, with "Reply on WhatsApp".
- **Stats:** most asked questions and unmatched phrases, to guide new FAQs and listings.

## Technical outline

- `js/chat.js` loaded with `defer`; the panel is built on first open, so the page load is unchanged.
- Replies: `api/chat-replies.php` (public, cached), editable in admin. Built-in defaults ship in the script so it works offline from the API.
- Order lookup: `api/chat-order-status.php`, POST, rate limited (10 per 10 min per IP), needs order code plus the matching email or phone, returns only status, date and tracking number.
- Messages: `api/chat-message.php`, rate limited, honeypot field, same validation as the IT enquiry form.
- Works with the site's Content-Security-Policy (no inline scripts, no outside hosts).
- Respects reduced motion; keyboard and screen-reader friendly (dialog role, focus trap, Esc to close).

## Options considered

| Option | Cost | For | Against |
| --- | --- | --- | --- |
| A. Own fixed-reply assistant (chosen) | Free | Themed, uses live products and orders, CSP-safe, no tracking, approved wording only | Answers only what is written |
| B. WhatsApp Business auto-replies | Free | Greeting and away messages | Only after the customer opens WhatsApp |
| C. Tawk.to / Crisp widget | Free tier | Live chat app | Third-party branding and scripts, CSP must be loosened, someone must be online |
| D. AI chatbot (Claude or GPT) | Per message | Understands anything | Running cost; risk of wrong health claims for wellness products; needs strict guardrails |

An AI layer can be added on top of A later, limited to product and policy facts.

## Effort

1. Chat panel, fixed replies, product search, WhatsApp handoff: one session.
2. Order tracking, message inbox, admin reply editor, stats: one session.
