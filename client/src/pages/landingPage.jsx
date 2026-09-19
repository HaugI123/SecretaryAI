import React, { useState } from 'react';
import DocumentScanner from '../components/scanner.jsx';

export default function LandingPage() {
    const [currentScreen, setCS] = useState('ROLE_SELECTION');
    const [submittingInfo, setSubmitting] = useState(false);
    const [testUpload, setTest] = useState(false);

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

    //These two functions are just fake ways to simulate database calls and verification. The timeout just waits for x time 1200 to simulate a database check.
    const handleNewClientSubmit = (e) => {
        e.preventDefault();
        setSubmitting(true);
        setTimeout(() => {
            setSubmitting(false);
            setCS('DOCS_PORTAL');
        }, 1200);
    };

    const handleVerifyClientSubmit = (e) => {
        e.preventDefault();
        setSubmitting(true);
        setTimeout(() => {
            setSubmitting(false);
            setCS('DOCS_PORTAL');
        }, 1200);
    };


    if (currentScreen === 'ROLE_SELECTION') {
        return (
            <div>
                <h1>Welcome</h1>

                <button onClick={() => setCS('CLIENT_SELECTION')}>
                    Client
                </button>

                <button onClick={() => setCS('EMPLOYEE_LOGIN')}>
                    Employee
                </button>
            </div>
        );
    }

    if (currentScreen === 'CLIENT_SELECTION') {
        return (
            <div>
                <h1>Client</h1>
                <p>Are you a new or returning client?</p>

                <button onClick={() => setCS('NEW_CLIENT')}>
                    New
                </button>

                <button onClick={() => setCS('VERIFY_CLIENT')}>
                    Returning
                </button>

                <br />
                <br />

                <button onClick={() => setCS('ROLE_SELECTION')}>
                    Back
                </button>
            </div>
        );
    }

    if (currentScreen === 'NEW_CLIENT') {
        return (
            <div>
                <h1>New Client Information</h1>

                <form onSubmit={handleNewClientSubmit}>

                    <input
                    type="text"
                    name="firstName"
                    placeholder="First Name"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    />

                    <br />

                    <input
                    type="text"
                    name="lastName"
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    />

                    <br />

                    <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    />

                    <br />

                    <input
                    type="tel"
                    name="phone"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    />

                    <br />

                    <input
                    type="ssn_last_four"
                    name="ssn_last_four"
                    placeholder="ssn_last_four"
                    value={formData.ssn_last_four}
                    onChange={handleInputChange}
                    required
                    />

                    <br />

                    <input
                    type="address"
                    name="address"
                    placeholder="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    />

                    

                    <br />
                    <br />

                    <button type="submit" disabled={submittingInfo}>
                    {submittingInfo ? 'Submitting...' : 'Submit'}
                    </button>
                </form>

                <br />

                <button onClick={() => setCS('CLIENT_SELECTION')}>
                Back
                </button>
            </div>
        );
    }

    if (currentScreen === 'VERIFY_CLIENT') {
        return (
            <div>
                <h1>Verify Information</h1>

                <p>
                Please enter your information to verify your account.
                </p>

                <form onSubmit={handleVerifyClientSubmit}>

                    <input
                    type="text"
                    name="firstName"
                    placeholder="First Name"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    />

                    <br />

                    <input
                    type="text"
                    name="lastName"
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    />

                    <br />

                    <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    />

                    <br />

                    <input
                    type="tel"
                    name="phone"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    />

                    <input
                    type="ssn_last_four"
                    name="ssn_last_four"
                    placeholder="ssn_last_four"
                    value={formData.ssn_last_four}
                    onChange={handleInputChange}
                    required
                    />

                    <input
                    type="address"
                    name="address"
                    placeholder="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    />

                    <br />
                    <br />

                    <button type="submit" disabled={submittingInfo}>
                    {submittingInfo ? 'Verifying...' : 'Verify Information'}
                    </button>
                </form>

                <br />

                <button onClick={() => setCS('CLIENT_SELECTION')}>
                    Back
                </button>
            </div>
        );
    }

    if (currentScreen === 'EMPLOYEE_LOGIN') {
        return (
            <div>
                <h1>Employee Login</h1>

                <input type="text" placeholder="Username"/>

                <br />

                <input type="password" placeholder="Password"/>

                <br />
                <br />

                <button
                onClick={() => alert('Employee login would be handled here. We would put the login function here. API calls to backend/database function calls.')}
                >
                    Login
                </button>

                <br />
                <br />

                <button onClick={() => setCS('ROLE_SELECTION')}>
                    Back
                </button>

            </div>
        );
    }

    if (currentScreen === 'DOCS_PORTAL') {
        return (
            <div>
                <h1>Documents</h1>

                <p>Please upload the following documents.</p>

                <div>
                    <button onClick={() => setDocument('W2')}>
                        Upload W2
                    </button>

                </div>

                <div>
                    <button onClick={() => setDocument('prevTaxReturn')}>
                        Upload Previous Tax Returns
                    </button>

                </div>

                <div>
                    <button onClick={() => setDocument('1099')}>
                        Upload Form 1099
                    </button>

                </div>

                <div>
                    <button onClick={() => setTest(true)}>
                        Upload Additional Documents (WE CAN ADD MORE/CHANGE LATER THIS IS SKELETON CODE JUST TO HAVE FUNCTIONING SHIT)
                    </button>

                </div>

            <br />

                <button onClick={() => setCS('ROLE_SELECTION')}>
                Start Over
                </button>

                {testUpload && (
                    <DocumentScanner onClose={() => setTest(false)}/>
                )}

            </div>
        );
    }

    return (
        <div>
            <h1>Something went wrong</h1>

            <button onClick={() => setCS('ROLE_SELECTION')}>
                Start Over
            </button>
        </div>
    );
}
