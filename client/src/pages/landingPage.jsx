import { useState } from 'react';
import DocumentScanner from '../components/scanner.jsx';

function ScreenShell({ eyebrow, title, description, children, onBack }) {
    return (
        <main className="app-shell">
            <header className="brand-bar">
                <div className="brand-lockup">
                    <span className="brand-mark">SA</span>
                    <span className="brand-name">SecretaryAI</span>
                </div>
                <span className="secure-label"><span className="status-dot" /> Secure intake</span>
            </header>

            <section className="screen-card">
                <div className="screen-heading">
                    <p className="eyebrow">{eyebrow}</p>
                    <h1>{title}</h1>
                    {description && <p className="screen-description">{description}</p>}
                </div>
                {children}
                {onBack && (
                    <button className="button button-quiet" onClick={onBack}>
                        <span aria-hidden="true">&#8592;</span> Back
                    </button>
                )}
            </section>
            <footer className="app-footer">Private document intake for your tax preparation team</footer>
        </main>
    );
}

export default function LandingPage() {
    const [currentScreen, setCS] = useState('ROLE_SELECTION');
    const [submittingInfo, setSubmitting] = useState(false);
    const [testUpload, setTest] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});

    //Just some fake form data for "login"/verification purposes. We can change this to whatever info we want and change it based on new client vs returning. A returning may only need first name and email or phone, while a new client needs everything etc..
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        ssn_last_four: '',
        address: '',
    });

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const validateForm = () => {
        const errors = {};

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Enter a valid email address.';
        }

        if (!/^\d{3}-\d{3}-\d{4}$/.test(formData.phone)) {
            errors.phone = 'Use the format xxx-xxx-xxxx.';
        }

        if (!/^\d{3}-\d{2}-\d{4}$/.test(formData.ssn_last_four)) {
            errors.ssn_last_four = 'Use the format xxx-xx-xxxx.';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const renderError = (fieldName) => (
        validationErrors[fieldName] && (
            <p className="field-error" role="alert">
                {validationErrors[fieldName]}
            </p>
        )
    );

    const handleNewClientSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch('http://localhost:5000/api/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    email: formData.email,
                    phone: formData.phone,
                    ssn_last_four: formData.ssn_last_four,
                    address: formData.address,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Unable to save client information.');
            }

            setCS('DOCS_PORTAL');
        } catch (error) {
            alert(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyClientSubmit = (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        setTimeout(() => {
            setSubmitting(false);
            setCS('DOCS_PORTAL');
        }, 1200);
    };


    if (currentScreen === 'ROLE_SELECTION') {
        return (
            <ScreenShell
                eyebrow="Your trusted tax partner"
                title="Let’s get your paperwork moving."
                description="Choose the path that brings you to the right place. Your information stays private and secure."
            >
                <div className="choice-grid">
                    <button className="choice-card" onClick={() => setCS('CLIENT_SELECTION')}>
                        <span className="choice-icon" aria-hidden="true">&#8594;</span>
                        <span>
                            <strong>I’m a client</strong>
                            <small>Start or continue your tax intake</small>
                        </span>
                    </button>
                    <button className="choice-card" onClick={() => setCS('EMPLOYEE_LOGIN')}>
                        <span className="choice-icon choice-icon-muted" aria-hidden="true">&#128100;</span>
                        <span>
                            <strong>Team sign in</strong>
                            <small>Access the preparer workspace</small>
                        </span>
                    </button>
                </div>
            </ScreenShell>
        );
    }

    if (currentScreen === 'CLIENT_SELECTION') {
        return (
            <ScreenShell
                eyebrow="Client portal / 01"
                title="Welcome back."
                description="Tell us where you are in the process so we can personalize your next step."
                onBack={() => setCS('ROLE_SELECTION')}
            >
                <div className="choice-grid">
                    <button className="choice-card choice-card-accent" onClick={() => setCS('NEW_CLIENT')}>
                        <span className="choice-number">01</span>
                        <span>
                            <strong>New client</strong>
                            <small>Share your details and start an intake</small>
                        </span>
                    </button>
                    <button className="choice-card" onClick={() => setCS('VERIFY_CLIENT')}>
                        <span className="choice-number">02</span>
                        <span>
                            <strong>Returning client</strong>
                            <small>Verify your information and continue</small>
                        </span>
                    </button>
                </div>
            </ScreenShell>
        );
    }

    if (currentScreen === 'NEW_CLIENT') {
        return (
            <ScreenShell
                eyebrow="New client / 02"
                title="A few details to begin."
                description="Complete your profile below. We’ll use this information to prepare your secure document checklist."
                onBack={() => setCS('CLIENT_SELECTION')}
            >
                <form className="intake-form" onSubmit={handleNewClientSubmit}>
                    <div className="form-grid">
                        <label>First name
                            <input type="text" name="firstName" placeholder="Jordan" value={formData.firstName} onChange={handleInputChange} required />
                        </label>
                        <label>Last name
                            <input type="text" name="lastName" placeholder="Lee" value={formData.lastName} onChange={handleInputChange} required />
                        </label>
                        <label className="field-wide">Email address
                            <input type="email" name="email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} pattern="[^\\s@]+@[^\\s@]+\\.[^\\s@]+" required />
                            {renderError('email')}
                        </label>
                        <label>Phone number
                            <input type="tel" name="phone" placeholder="555-555-0123" value={formData.phone} onChange={handleInputChange} pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" title="Use the format xxx-xxx-xxxx." required />
                            {renderError('phone')}
                        </label>
                        <label>Social security number
                            <input type="text" name="ssn_last_four" placeholder="123-45-6789" value={formData.ssn_last_four} onChange={handleInputChange} pattern="[0-9]{3}-[0-9]{2}-[0-9]{4}" title="Use the format xxx-xx-xxxx." required />
                            {renderError('ssn_last_four')}
                        </label>
                        <label className="field-wide">Mailing address
                            <input type="text" name="address" placeholder="123 Main Street" value={formData.address} onChange={handleInputChange} required />
                        </label>
                    </div>
                    <button className="button button-primary" type="submit" disabled={submittingInfo}>
                        {submittingInfo ? 'Saving your details...' : 'Continue to documents'} <span aria-hidden="true">&#8594;</span>
                    </button>
                </form>
            </ScreenShell>
        );
    }

    if (currentScreen === 'VERIFY_CLIENT') {
        return (
            <ScreenShell
                eyebrow="Returning client / 02"
                title="Let’s pick up where you left off."
                description="Confirm the details we have on file and we’ll take you to your document checklist."
                onBack={() => setCS('CLIENT_SELECTION')}
            >
                <form className="intake-form" onSubmit={handleVerifyClientSubmit}>
                    <div className="form-grid">
                        <label>First name
                            <input type="text" name="firstName" placeholder="Jordan" value={formData.firstName} onChange={handleInputChange} required />
                        </label>
                        <label>Last name
                            <input type="text" name="lastName" placeholder="Lee" value={formData.lastName} onChange={handleInputChange} required />
                        </label>
                        <label className="field-wide">Email address
                            <input type="email" name="email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} pattern="[^\\s@]+@[^\\s@]+\\.[^\\s@]+" required />
                            {renderError('email')}
                        </label>
                        <label>Phone number
                            <input type="tel" name="phone" placeholder="555-555-0123" value={formData.phone} onChange={handleInputChange} pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" title="Use the format xxx-xxx-xxxx." required />
                            {renderError('phone')}
                        </label>
                        <label>Social security number
                            <input type="text" name="ssn_last_four" placeholder="123-45-6789" value={formData.ssn_last_four} onChange={handleInputChange} pattern="[0-9]{3}-[0-9]{2}-[0-9]{4}" title="Use the format xxx-xx-xxxx." required />
                            {renderError('ssn_last_four')}
                        </label>
                        <label className="field-wide">Mailing address
                            <input type="text" name="address" placeholder="123 Main Street" value={formData.address} onChange={handleInputChange} required />
                        </label>
                    </div>
                    <button className="button button-primary" type="submit" disabled={submittingInfo}>
                        {submittingInfo ? 'Checking your details...' : 'Continue to documents'} <span aria-hidden="true">&#8594;</span>
                    </button>
                </form>
            </ScreenShell>
        );
    }

    if (currentScreen === 'EMPLOYEE_LOGIN') {
        return (
            <ScreenShell
                eyebrow="Team workspace"
                title="Welcome back, team."
                description="Sign in to manage client intake and keep every return moving forward."
                onBack={() => setCS('ROLE_SELECTION')}
            >
                <form className="intake-form" onSubmit={(event) => { event.preventDefault(); alert('Employee login would be handled here.'); }}>
                    <label>Email or username
                        <input type="text" placeholder="you@secretaryai.com" required />
                    </label>
                    <label>Password
                        <input type="password" placeholder="Enter your password" required />
                    </label>
                    <button className="button button-primary" type="submit">Sign in <span aria-hidden="true">&#8594;</span></button>
                </form>
            </ScreenShell>
        );
    }

    if (currentScreen === 'DOCS_PORTAL') {
        return (
            <ScreenShell
                eyebrow="Your checklist / 03"
                title="Documents, made simple."
                description="Upload the documents your preparer needs. You can return here anytime to add another file."
            >
                <div className="document-list">
                    <button className="document-row" onClick={() => setTest(true)}><span className="document-icon">W2</span><span><strong>W-2 forms</strong><small>Upload your wage and tax statement</small></span><span className="row-arrow">&#8594;</span></button>
                    <button className="document-row" onClick={() => setTest(true)}><span className="document-icon">1040</span><span><strong>Previous tax return</strong><small>Share last year’s filed return</small></span><span className="row-arrow">&#8594;</span></button>
                    <button className="document-row" onClick={() => setTest(true)}><span className="document-icon">1099</span><span><strong>1099 forms</strong><small>Upload freelance or investment income</small></span><span className="row-arrow">&#8594;</span></button>
                </div>
                <button className="button button-quiet start-over" onClick={() => setCS('ROLE_SELECTION')}>Start over</button>
                {testUpload && <DocumentScanner onClose={() => setTest(false)} />}
            </ScreenShell>
        );
    }

    return (
        <ScreenShell eyebrow="SecretaryAI" title="Something went wrong." onBack={() => setCS('ROLE_SELECTION')}>
            <p className="screen-description">Let’s return to the beginning and try again.</p>
        </ScreenShell>
    );
}
