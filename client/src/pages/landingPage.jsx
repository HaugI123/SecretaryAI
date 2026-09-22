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

const languageOptions = [
    { code: 'en', label: 'English', greeting: 'Hi, I’m Ava. I’ll help you get everything ready.' },
    { code: 'es', label: 'Español', greeting: 'Hola, soy Ava. Te ayudaré a preparar todo.' },
    { code: 'fr', label: 'Français', greeting: 'Bonjour, je suis Ava. Je vais vous aider à tout préparer.' },
    { code: 'pt', label: 'Português', greeting: 'Olá, sou Ava. Vou ajudar você a preparar tudo.' },
    { code: 'zh', label: '中文', greeting: '你好，我是 Ava。我会帮助你准备好一切。' },
    { code: 'vi', label: 'Tiếng Việt', greeting: 'Xin chào, tôi là Ava. Tôi sẽ giúp bạn chuẩn bị mọi thứ.' },
    { code: 'ko', label: '한국어', greeting: '안녕하세요, Ava입니다. 필요한 준비를 도와드리겠습니다.' },
    { code: 'ar', label: 'العربية', greeting: 'مرحبًا، أنا Ava. سأساعدك في تجهيز كل شيء.' },
    { code: 'tl', label: 'Tagalog', greeting: 'Kumusta, ako si Ava. Tutulungan kitang ihanda ang lahat.' },
];

const ADMIN_CREDENTIALS = {
    username: 'Admin001',
    password: 'Admin001@',
};

export default function LandingPage() {
    const [currentScreen, setCS] = useState('ROLE_SELECTION');
    const [submittingInfo, setSubmitting] = useState(false);
    const [testUpload, setTest] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const [selectedLanguage, setSelectedLanguage] = useState(null);
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [loginError, setLoginError] = useState('');

    const getStoredSession = () => {
        try {
            const session = localStorage.getItem('secretaryAiTeamSession');
            return session ? JSON.parse(session) : null;
        } catch (error) {
            return null;
        }
    };

    const clearStoredSession = () => {
        localStorage.removeItem('secretaryAiTeamSession');
    };

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

    const resetClientForm = () => {
        setFormData({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            ssn_last_four: '',
            address: '',
        });
        setValidationErrors({});
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

    const handleLoginInputChange = (e) => {
        setLoginForm({
            ...loginForm,
            [e.target.name]: e.target.value,
        });

        if (loginError) {
            setLoginError('');
        }
    };

    const handleEmployeeLogin = (event) => {
        event.preventDefault();

        const submittedUsername = loginForm.username.trim();
        const submittedPassword = loginForm.password;

        if (submittedUsername !== ADMIN_CREDENTIALS.username || submittedPassword !== ADMIN_CREDENTIALS.password) {
            setLoginError('Invalid username or password. Use Admin001 and Admin001@.');
            return;
        }

        const session = {
            username: submittedUsername,
            loggedInAt: new Date().toISOString(),
        };

        localStorage.setItem('secretaryAiTeamSession', JSON.stringify(session));
        setCS('EMPLOYEE_DASHBOARD');
    };

    const handleLogout = () => {
        clearStoredSession();
        setLoginForm({ username: '', password: '' });
        setLoginError('');
        setCS('EMPLOYEE_LOGIN');
    };

    const goBackToRoleSelection = () => {
        resetClientForm();
        setSelectedLanguage(null);
        setCS('ROLE_SELECTION');
    };

    const session = getStoredSession();
    const isAuthenticated = Boolean(session && session.username === ADMIN_CREDENTIALS.username);

    if (currentScreen === 'ROLE_SELECTION') {
        return (
            <ScreenShell
                eyebrow="Your trusted tax partner"
                title="Let’s get your paperwork moving."
                description="Choose the path that brings you to the right place. Your information stays private and secure."
            >
                <div className="choice-grid">
                    <button className="choice-card" onClick={() => setCS('LANGUAGE_SELECTION')}>
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

    if (currentScreen === 'LANGUAGE_SELECTION') {
        return (
            <ScreenShell
                eyebrow="Ava, your intake assistant"
                title="How would you like to continue?"
                description="Choose the language you’re most comfortable using. You can change it later."
                onBack={goBackToRoleSelection}
            >
                <div className="assistant-message">
                    <span className="assistant-avatar">A</span>
                    <p>Welcome. I’ll guide you through each step and keep things simple.</p>
                </div>
                <div className="language-grid">
                    {languageOptions.map((language) => (
                        <button
                            className="language-option"
                            key={language.code}
                            onClick={() => {
                                setSelectedLanguage(language);
                                setCS('CLIENT_SELECTION');
                            }}
                        >
                            <span className="language-code">{language.code.toUpperCase()}</span>
                            <span>{language.label}</span>
                            <span className="language-arrow" aria-hidden="true">&#8594;</span>
                        </button>
                    ))}
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
                onBack={goBackToRoleSelection}
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
                {selectedLanguage && (
                    <div className="assistant-message assistant-message-bottom">
                        <span className="assistant-avatar">A</span>
                        <p>{selectedLanguage.greeting} What would you like to do today?</p>
                    </div>
                )}
            </ScreenShell>
        );
    }

    if (currentScreen === 'NEW_CLIENT') {
        return (
            <ScreenShell
                eyebrow="New client / 02"
                title="A few details to begin."
                description="Complete your profile below. We’ll use this information to prepare your secure document checklist."
                onBack={() => {
                    resetClientForm();
                    setCS('CLIENT_SELECTION');
                }}
            >
                <form className="intake-form" onSubmit={handleNewClientSubmit}>
                    <div className="assistant-message assistant-message-form">
                        <span className="assistant-avatar">A</span>
                        <p>Let’s start with the basics. I’ll only ask for what your preparer needs.</p>
                    </div>
                    <div className="form-grid">
                        <label>First name
                            <input type="text" name="firstName" placeholder="Jordan" value={formData.firstName} onChange={handleInputChange} required />
                        </label>
                        <label>Last name
                            <input type="text" name="lastName" placeholder="Lee" value={formData.lastName} onChange={handleInputChange} required />
                        </label>
                        <label className="field-wide">Email address
                            <input type="email" name="email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} pattern="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}" required />
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
                onBack={() => {
                    resetClientForm();
                    setCS('CLIENT_SELECTION');
                }}
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
                            <input type="email" name="email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} pattern="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}" required />
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
                <form className="intake-form" onSubmit={handleEmployeeLogin}>
                    <label>Username
                        <input
                            type="text"
                            name="username"
                            placeholder="Admin001"
                            value={loginForm.username}
                            onChange={handleLoginInputChange}
                            required
                        />
                    </label>
                    <label>Password
                        <input
                            type="password"
                            name="password"
                            placeholder="Enter your password"
                            value={loginForm.password}
                            onChange={handleLoginInputChange}
                            required
                        />
                    </label>
                    {loginError && (
                        <p className="field-error" role="alert">{loginError}</p>
                    )}
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

     if (currentScreen === 'EMPLOYEE_DASHBOARD') {
        if (!isAuthenticated) {
            return (
                <ScreenShell
                    eyebrow="Team workspace"
                    title="Session expired"
                    description="Your sign-in session is invalid or has expired. Please sign in again."
                    onBack={() => setCS('ROLE_SELECTION')}
                >
                    <button className="button button-primary" onClick={() => setCS('EMPLOYEE_LOGIN')}>
                        Return to sign in <span aria-hidden="true">&#8594;</span>
                    </button>
                </ScreenShell>
            );
        }

        return (
            <ScreenShell
                eyebrow="Team workspace"
                title="Employee Dashboard"
                description="Manage your clients and quickly access recent records."
                onBack={handleLogout}
            >
                <div className="employee-dashboard">
                    <div className="dashboard-topbar">
                        <div className="dashboard-greeting">
                            <span className="dashboard-pill">Live</span>
                            <div>
                                <p className="dashboard-kicker">Welcome back</p>
                                <h3>Admin001</h3>
                            </div>
                        </div>

                        <div className="client-list">

                            <div className="client-table-container">
                         <table className="client-table">
                             <thead>
                              <tr>
                                  <th>No.</th>
                                  <th>First Name</th>
                                  <th>Last Name</th>
                                  <th>Email</th>
                                  <th>Phone Number</th>
                                  <th>Address</th>
                             </tr>
                         </thead>

                         <tbody>
                                <tr>
                                 <td>1</td>
                                 <td>Matthew</td>
                                 <td>Steen</td>
                                 <td>MSteen@example.com</td>
                                 <td>417-893-1689</td>
                                  <td>123 Question Street</td>
                              </tr>

                              <tr>
                                  <td>2</td>
                                  <td>Branda</td>
                                 <td>Stop</td>
                                  <td>StopB@example.com</td>
                                 <td>617-290-9164</td>
                                  <td>384 Oak Street</td>
                              </tr>

                             <tr>
                                 <td>3</td>
                                 <td>Robert</td>
                                 <td>Johnson</td>
                                 <td>robert@example.com</td>
                                 <td>555-555-5555</td>
                                 <td>789 God Road</td>
                             </tr>
                              </tbody>
                         </table>
                    </div>

                        </div>

                        <button
                            className="button button-primary dashboard-register"
                            type="button"
                            onClick={() => setCS('CLIENT_SELECTION')}
                        >
                            Register New Client
                            <span aria-hidden="true">&#8594;</span>
                        </button>
                    </div>

                    <div className="dashboard-summary">
                        <div className="summary-card summary-card-primary">
                            <span>Total clients: </span>
                            <strong>128 </strong>
                            <small>+12 this month</small>
                        </div>

                        <div className="recent-list">

                         <button className="recent-client" type="button">
                                Matthew Steen
                         </button>

                         <button className="recent-client" type="button">
                                Branda Stop
                          </button>

                         <button className="recent-client" type="button">
                                Robert Johnson
                          </button>

                        </div>
                        <div className="summary-card">
                            <span>Documents uploaded: </span>
                            <strong>94% </strong>
                            <small>Above target</small>
                        </div>
                    </div>

                    <div className="dashboard-search">
                        <input
                            type="text"
                            placeholder="Search clients by name, email, or phone..."
                        />
                        <button type="button">
                            &#128269;
                        </button>
                    </div>

                    <div className="dashboard-columns">
                        <section className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <h2>Client List</h2>
                                <span>All clients</span>
                            </div>

                            <div className="client-list">
                                <button className="client-card client-card-row">
                                    <div className="client-card-cell client-name-cell">
                                        <span className="client-label">Name: </span>
                                        <strong>Matthew Steen</strong>
                                    </div>
                                    <div className="client-card-cell">
                                        <span className="client-label">Email: </span>
                                        <small>MSteen@example.com</small>
                                    </div>
                                    <div className="client-card-cell">
                                        <span className="client-label">Phone: </span>
                                        <small>417-893-1689</small>
                                    </div>
                                    <div className="client-card-cell client-address-cell">
                                        <span className="client-label">Address: </span>
                                        <small>123 Question Street</small>
                                    </div>
                                    <span className="status-badge status-badge-ok">Active</span>
                                </button>

                                <button className="client-card client-card-row">
                                    <div className="client-card-cell client-name-cell">
                                        <span className="client-label">Name: </span>
                                        <strong>Branda Stop</strong>
                                    </div>
                                    <div className="client-card-cell">
                                        <span className="client-label">Email: </span>
                                        <small>StopB@example.com</small>
                                    </div>
                                    <div className="client-card-cell">
                                        <span className="client-label">Phone: </span>
                                        <small>617-290-9164</small>
                                    </div>
                                    <div className="client-card-cell client-address-cell">
                                        <span className="client-label">Address: </span>
                                        <small>384 Oak Street</small>
                                    </div>
                                    <span className="status-badge status-badge-warn">Review</span>
                                </button>

                                <button className="client-card client-card-row">
                                    <div className="client-card-cell client-name-cell">
                                        <span className="client-label">Name: </span>
                                        <strong>Robert Johnson</strong>
                                    </div>
                                    <div className="client-card-cell">
                                        <span className="client-label">Email: </span>
                                        <small>robert@example.com</small>
                                    </div>
                                    <div className="client-card-cell">
                                        <span className="client-label">Phone: </span>
                                        <small>555-555-5555</small>
                                    </div>
                                    <div className="client-card-cell client-address-cell">
                                        <span className="client-label">Address: </span>
                                        <small>789 God Road</small>
                                    </div>
                                    <span className="status-badge">New</span>
                                </button>
                            </div>

                            <button
                                className="button button-primary dashboard-register"
                                type="button"
                                onClick={() => setCS('CLIENT_SELECTION')}
                            >
                                Register New Client
                                <span aria-hidden="true">&#8594;</span>
                            </button>
                        </section>

                        <section className="dashboard-panel">
                            <div className="dashboard-panel-header">
                                <h2>Recent</h2>
                                <span>Recently viewed </span>
                            </div>

                            <div className="recent-list">
                                <button className="recent-client">
                                    <strong>Matthew Steen </strong>
                                    <small>Recently viewed </small>
                                </button>

                                <button className="recent-client">
                                    <strong>Branda Stop </strong>
                                    <small>Recently viewed</small>
                                </button>

                                <button className="recent-client">
                                    <strong>Robert Johnson </strong>
                                    <small>Recently viewed </small>
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </ScreenShell>
        );
    }

    return (
        <ScreenShell eyebrow="SecretaryAI" title="Something went wrong." onBack={() => setCS('ROLE_SELECTION')}>
            <p className="screen-description">Let’s return to the beginning and try again.</p>
        </ScreenShell>
    );
}
