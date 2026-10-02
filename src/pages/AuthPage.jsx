import { useMemo, useState } from 'react';

const modeLabels = {
  login: 'Log in',
  signup: 'Create account',
};

function AuthPage({ onLogin, onSignUp, authError }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const headerCopy = useMemo(
    () =>
      mode === 'login'
        ? 'Welcome back to HackMate.'
        : 'Set up your HackMate profile and start building your team.',
    [mode],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('');

    if (!form.email.trim() || !form.password.trim()) {
      setStatus('Email and password are required.');
      return;
    }

    if (mode === 'signup' && !form.name.trim()) {
      setStatus('Please enter your name to complete signup.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await onLogin({
          email: form.email.trim(),
          password: form.password.trim(),
        });
        setStatus('Signed in successfully.');
      } else {
        await onSignUp({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
        });
        setStatus('Account created. Check your inbox if email confirmation is enabled.');
      }
    } catch (error) {
      setStatus(error?.message || 'An authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand-row">
          <div className="brand-mark">H</div>
          <div>
            <div className="brand-name">HackMate</div>
            <div className="brand-tag">AI hackathon team finder</div>
          </div>
        </div>

        <div className="auth-toggle" aria-label="Authentication mode selector">
          <button
            type="button"
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>

        <div className="auth-copy">
          <h1>{modeLabels[mode]}</h1>
          <p>{headerCopy}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label className="auth-field">
              <span>Name</span>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your full name"
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
            />
          </label>

          {(authError || status) && (
            <div className={authError ? 'auth-message error' : 'auth-message'}>{authError || status}</div>
          )}

          <button type="submit" className="primary-button full-width auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : modeLabels[mode]}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthPage;
