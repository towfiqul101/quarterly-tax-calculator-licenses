// License Validation API for Quarterly Tax Calculator
// Fetches licenses from GitHub and validates the provided key

const GITHUB_LICENSES_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/quarterly-tax-calculator-licenses/main/licenses.json';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { key } = req.query;

    // Check if key is provided
    if (!key) {
        return res.status(400).json({
            valid: false,
            error: 'MISSING_KEY',
            message: 'No license key provided. Please contact your tax professional.'
        });
    }

    try {
        // Fetch licenses from GitHub
        const response = await fetch(GITHUB_LICENSES_URL, {
            headers: {
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch licenses:', response.status);
            return res.status(500).json({
                valid: false,
                error: 'LICENSE_FETCH_ERROR',
                message: 'Unable to validate license. Please try again later.'
            });
        }

        const licenses = await response.json();

        // Find matching license
        const license = licenses.find(l => l.key === key);

        if (!license) {
            return res.status(401).json({
                valid: false,
                error: 'INVALID_LICENSE',
                message: 'License key not found. Please contact your tax professional.'
            });
        }

        // Check if license is active
        if (license.status !== 'active') {
            return res.status(401).json({
                valid: false,
                error: 'LICENSE_INACTIVE',
                message: 'This license is no longer active. Please contact your tax professional.'
            });
        }

        // Check expiration
        if (license.expires) {
            const expirationDate = new Date(license.expires);
            if (expirationDate < new Date()) {
                return res.status(401).json({
                    valid: false,
                    error: 'LICENSE_EXPIRED',
                    message: 'This license has expired. Please contact your tax professional.'
                });
            }
        }

        // Check domain (optional - allow Vercel preview domains)
        const referer = req.headers.referer || req.headers.origin || '';
        const requestDomain = new URL(referer || 'http://localhost').hostname;
        
        // Skip domain check for Vercel preview/development
        const isVercelDomain = requestDomain.includes('vercel.app') || 
                              requestDomain === 'localhost' ||
                              requestDomain === '127.0.0.1';

        if (license.domain && !isVercelDomain) {
            if (!requestDomain.includes(license.domain)) {
                return res.status(401).json({
                    valid: false,
                    error: 'DOMAIN_MISMATCH',
                    message: 'This license is not valid for this domain.'
                });
            }
        }

        // License is valid - return config
        return res.status(200).json({
            valid: true,
            config: {
                client: license.client,
                domain: license.domain,
                logo: license.logo || null,
                primaryColor: license.primaryColor || '#4f46e5',
                webhook: license.webhook || null,
                ctaUrl: license.ctaUrl || '#',
                ctaText: license.ctaText || '📞 Schedule a Tax Consultation'
            }
        });

    } catch (error) {
        console.error('License validation error:', error);
        return res.status(500).json({
            valid: false,
            error: 'SERVER_ERROR',
            message: 'An error occurred during validation. Please try again.'
        });
    }
}
