const { expect } = require('chai');
const sinon = require('sinon');
const { URL } = require('url');
const queryString = require('querystring');

const httpClient = require('@src/clients/http-client');
const LWAClient = require('@src/clients/lwa-auth-code-client');
const CONSTANTS = require('@src/utils/constants');

describe('# Clients test - LWA OAuth2 client test', () => {
    const TEST_BASIC_CONFIGURATION = {
        doDebug: false,
        state: 'state',
        scope: 'scope',
        redirectUri: 'redirectUri'
    };
    const EMPTY_CONFIG = {};
    const authorizePath = CONSTANTS.LWA.DEFAULT_AUTHORIZE_PATH;
    const tokenPath = CONSTANTS.LWA.DEFAULT_TOKEN_PATH;
    const authorizeHost = CONSTANTS.LWA.DEFAULT_AUTHORIZE_HOST;
    const tokenHost = CONSTANTS.LWA.DEFAULT_TOKEN_HOST;
    const DEFAULT_CLIENT_ID = CONSTANTS.LWA.CLI_INTERNAL_ONLY_LWA_CLIENT.CLIENT_ID;
    const DEFAULT_CLIENT_CONFIRMATION = CONSTANTS.LWA.CLI_INTERNAL_ONLY_LWA_CLIENT.CLIENT_CONFIRMATION;
    const DEFAULT_SCOPE = CONSTANTS.LWA.DEFAULT_SCOPES;
    const currentDatePlusHalfAnHour = new Date(new Date(Date.now()).getTime() + (0.5 * 60 * 60 * 1000)).toISOString();
    const POST_REQUEST_METHOD = 'POST';
    const REFRESH_TOKEN_GRANT_TYPE = 'refresh_token';
    const AUTHORIZATION_CODE_GRANT_TYPE = 'authorization_code';
    const TEST_REQUEST_RESPONSE_ACCESS_TOKEN = {
        statusCode: 200,
        body: { token: 'BODY' },
        headers: {}
    };
    const VALID_AUTH_CODE = 'authCode';

    const VALID_ACCESS_TOKEN = {
        access_token: 'accessToken',
        refresh_token: 'refreshToken',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: currentDatePlusHalfAnHour
    };
    const INVALID_ACCESS_TOKEN = {
        expires_at: new Date('05 October 2011 14:48 UTC').toISOString()
    };

    describe('# inspect correctness for constructor', () => {
        it('| initiate as a LWAClient class', () => {
            // call
            const lwaClient = new LWAClient(TEST_BASIC_CONFIGURATION);
            // verify
            expect(lwaClient).to.be.instanceOf(LWAClient);
            expect(lwaClient.config.doDebug).equal(false);
            expect(lwaClient.config.authorizePath).equal(authorizePath);
            expect(lwaClient.config.tokenPath).equal(tokenPath);
        });
    });

    describe('# test generateAuthorizeUrl', () => {
        beforeEach(() => {
            sinon.useFakeTimers(Date.UTC(2016, 2, 15));
        });

        it('| test proper authorization code uri generation', () => {
            // setup
            const CONFIG = {
                doDebug: false,
                scope: 'scope',
                redirectUri: 'redirectUri'
            };
            const queryParamsUri = `response_type=code&client_id=${DEFAULT_CLIENT_ID}&state=1458000000000&scope=scope&redirect_uri=redirectUri`;

            const uri = `${authorizeHost}${authorizePath}?${queryParamsUri}`;
            const lwaClient = new LWAClient(CONFIG);
            // call & verify
            expect(lwaClient.generateAuthorizeUrl()).equal(uri);
        });

        it('| test authorization code uri generation with blank scope and redirectUri', () => {
            // setup
            sinon.stub(Date, 'now');
            Date.now.returns('date');
            const CONFIG = {
                doDebug: false,
                scope: '',
                redirectUri: '',
                state: ''
            };
            const outQueryParams = {
                response_type: 'code',
                client_id: DEFAULT_CLIENT_ID,
                state: 'date',
                scope: DEFAULT_SCOPE
            };

            const uri = `${authorizeHost}${authorizePath}?${queryString.stringify(outQueryParams)}`;
            const lwaClient = new LWAClient(CONFIG);
            // call & verify
            expect(lwaClient.generateAuthorizeUrl()).equal(uri);
        });

        afterEach(() => {
            sinon.restore();
        });
    });

    describe('# test isValidToken', () => {
        it('| access token is valid', () => {
            // setup
            const lwaClient = new LWAClient(EMPTY_CONFIG);
            // call & verify
            expect(lwaClient.isValidToken(VALID_ACCESS_TOKEN)).equal(true);
        });

        it('| access token is invalid', () => {
            // setup
            const lwaClient = new LWAClient(EMPTY_CONFIG);
            // call & verify
            expect(lwaClient.isValidToken(INVALID_ACCESS_TOKEN)).equal(false);
        });
    });

    describe('# test refreshToken', () => {
        beforeEach(() => {
            sinon.stub(httpClient, 'request');
        });

        it('| refreshing access token successful', (done) => {
            // setup
            const lwaClient = new LWAClient(TEST_BASIC_CONFIGURATION);
            httpClient.request.callsArgWith(3, null, TEST_REQUEST_RESPONSE_ACCESS_TOKEN);
            // call
            lwaClient.refreshToken(VALID_ACCESS_TOKEN, (err, res) => {
                const expectedOptions = {
                    url: `${new URL(tokenPath, tokenHost)}`,
                    method: POST_REQUEST_METHOD,
                    body: {
                        grant_type: REFRESH_TOKEN_GRANT_TYPE,
                        refresh_token: 'refreshToken',
                        client_id: DEFAULT_CLIENT_ID,
                        client_secret: DEFAULT_CLIENT_CONFIRMATION
                    },
                    json: true
                };
                // verify
                expect(httpClient.request.args[0][0]).deep.equal(expectedOptions);
                expect(httpClient.request.args[0][2]).equal(false);
                expect(err).equal(null);
                expect(res).deep.equal({ token: 'BODY' });
                done();
            });
        });

        it('| Failure while refreshing access token', (done) => {
            // setup
            const TEST_ERROR = 'error';
            const lwaClient = new LWAClient(TEST_BASIC_CONFIGURATION);
            httpClient.request.callsArgWith(3, TEST_ERROR);
            // call
            lwaClient.refreshToken(VALID_ACCESS_TOKEN, (err, res) => {
                // verify
                expect(err).equal(TEST_ERROR);
                expect(res).equal(undefined);
                done();
            });
        });

        afterEach(() => {
            sinon.restore();
        });
    });

    describe('# test getAccessTokenUsingAuthCode', () => {
        beforeEach(() => {
            sinon.stub(httpClient, 'request');
        });

        it('| fetch access token successful using auth code', (done) => {
            // setup
            const lwaClient = new LWAClient(TEST_BASIC_CONFIGURATION);
            httpClient.request.callsArgWith(3, null, TEST_REQUEST_RESPONSE_ACCESS_TOKEN);
            // call
            lwaClient.getAccessTokenUsingAuthCode(VALID_AUTH_CODE, (err, res) => {
                const expectedOptions = {
                    url: `${new URL(tokenPath, tokenHost)}`,
                    method: POST_REQUEST_METHOD,
                    body: {
                        code: 'authCode',
                        grant_type: AUTHORIZATION_CODE_GRANT_TYPE,
                        redirect_uri: 'redirectUri',
                        client_id: DEFAULT_CLIENT_ID,
                        client_secret: DEFAULT_CLIENT_CONFIRMATION
                    },
                    json: true
                };
                // verify
                expect(httpClient.request.args[0][0]).deep.equal(expectedOptions);
                expect(httpClient.request.args[0][2]).equal(false);
                expect(err).equal(null);
                expect(res).deep.equal({ token: 'BODY' });
                done();
            });
        });

        it('| Failure while fetching access token using auth code', (done) => {
            // setup
            const TEST_ERROR = 'error';
            const lwaClient = new LWAClient(TEST_BASIC_CONFIGURATION);
            httpClient.request.callsArgWith(3, TEST_ERROR);
            // call
            lwaClient.getAccessTokenUsingAuthCode(VALID_AUTH_CODE, (err, res) => {
                // verify
                expect(err).equal(TEST_ERROR);
                expect(res).equal(undefined);
                done();
            });
        });

        afterEach(() => {
            sinon.restore();
        });
    });

    describe('# test _handleDefaultLwaAuthCodeConfiguration', () => {
        let initialClientId;
        let initialClientConfirmation;

        beforeEach(() => {
            initialClientId = process.env.ASK_LWA_CLIENT_ID;
            initialClientConfirmation = process.env.ASK_LWA_CLIENT_CONFIRMATION;
        });

        it('| test default value setting in case of missing config values', () => {
            // call
            const lwaClient = new LWAClient(EMPTY_CONFIG);
            // verify
            expect(lwaClient.config.clientId).equal(DEFAULT_CLIENT_ID);
            expect(lwaClient.config.clientConfirmation).equal(DEFAULT_CLIENT_CONFIRMATION);
            expect(lwaClient.config.authorizeHost).equal(authorizeHost);
            expect(lwaClient.config.tokenHost).equal(tokenHost);
        });

        it('| test default value setting in case of non-empty config values', () => {
            // setup
            const NON_EMPTY_CONFIG = {
                clientId: 'clientId',
                clientConfirmation: 'clientConfirmation',
                scope: 'scope',
                state: 'state'
            };
            // call
            const lwaClient = new LWAClient(NON_EMPTY_CONFIG);
            // verify
            expect(lwaClient.config.clientId).equal('clientId');
            expect(lwaClient.config.clientConfirmation).equal('clientConfirmation');
            expect(lwaClient.config.scope).equal('scope');
            expect(lwaClient.config.state).equal('state');
        });

        it('| test default value setting in case of invalid config values', () => {
            // setup
            const INVALID_CONFIG = {
                clientId: ' ',
                clientConfirmation: ' '
            };
            process.env.ASK_LWA_CLIENT_ID = 'envClientId';
            process.env.ASK_LWA_CLIENT_CONFIRMATION = 'envClientConfirmation';
            // call
            const lwaClient = new LWAClient(INVALID_CONFIG);
            // verify
            expect(lwaClient.config.clientId).equal(process.env.ASK_LWA_CLIENT_ID);
            expect(lwaClient.config.clientConfirmation).equal(process.env.ASK_LWA_CLIENT_CONFIRMATION);
        });

        afterEach(() => {
            process.env.ASK_LWA_CLIENT_ID = initialClientId;
            process.env.ASK_LWA_CLIENT_CONFIRMATION = initialClientConfirmation;
            sinon.restore();
        });
    });
});
