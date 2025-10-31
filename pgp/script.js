try {
  if (openpgp.config) openpgp.config.disable_worker = true;
} catch {}

let generatedKeys = null;
let keyInfoForPrinting = {};

const keyForm = document.getElementById('keyForm');
const generateBtn = document.getElementById('generateBtn');
const errorMsg = document.getElementById('errorMsg');
const advancedToggle = document.getElementById('advancedToggle');
const advancedSection = document.getElementById('advancedSection');
const advancedToggleText = document.getElementById('advancedToggleText');
const subkeysToggle = document.getElementById('subkeysToggle');

const keyGenerationWrapper = document.getElementById('keyGenerationWrapper');
const keyGenInputSection = document.getElementById('keyGenInputSection');
const keyGenOutputSection = document.getElementById('keyGenOutputSection');
const pgpToolWrapper = document.getElementById('pgpToolWrapper');
const toolsContentArea = document.getElementById('toolsContentArea');
const toolsCategorySelector = document.getElementById('toolsCategorySelector');
const toolItemContainers = document.querySelectorAll('.tool-item-container');

const toggleToolsBtn = document.getElementById('toggleToolsBtn');
const singleBackToToolsBtn = document.getElementById('singleBackToToolsBtn');
const toolCategoryButtons = document.querySelectorAll('.tool-category-btn');
const backToToolInputButtons = document.querySelectorAll('.back-to-tool-input-btn');
const resetBtn = document.getElementById('resetBtn');

const publicKeyOutput = document.getElementById('publicKeyOutput');
const keyIdOutput = document.getElementById('keyIdOutput');
const fingerprintOutput = document.getElementById('fingerprintOutput');
const privateKeyNote = document.getElementById('privateKeyNote');
const forgetPrivateKeyBtn = document.getElementById('forgetPrivateKeyBtn');

const encryptTool = document.getElementById('encryptTool');
const encryptInputSection = encryptTool.querySelector('.tool-input-section');
const encryptOutputSection = encryptTool.querySelector('.tool-output-section');
const encryptMessageInput = document.getElementById('encryptMessageInput');
const publicKeyEncryptInput = document.getElementById('publicKeyEncryptInput');
const useGeneratedPublicKeyBtn = document.getElementById('useGeneratedPublicKeyBtn');
const encryptError = document.getElementById('encryptError');
const encryptBtn = document.getElementById('encryptBtn');
const encryptedMessageOutput = document.getElementById('encryptedMessageOutput');

const decryptTool = document.getElementById('decryptTool');
const decryptInputSection = decryptTool.querySelector('.tool-input-section');
const decryptOutputSection = decryptTool.querySelector('.tool-output-section');
const decryptMessageInput = document.getElementById('decryptMessageInput');
const privateKeyDecryptInput = document.getElementById('privateKeyDecryptInput');
const passphraseDecryptInput = document.getElementById('passphraseDecryptInput');
const useGeneratedPrivateKeyBtn = document.getElementById('useGeneratedPrivateKeyBtn');
const decryptError = document.getElementById('decryptError');
const decryptBtn = document.getElementById('decryptBtn');
const decryptedMessageOutput = document.getElementById('decryptedMessageOutput');

const signTool = document.getElementById('signTool');
const signInputSection = signTool.querySelector('.tool-input-section');
const signOutputSection = signTool.querySelector('.tool-output-section');
const signMessageInput = document.getElementById('signMessageInput');
const privateKeySignInput = document.getElementById('privateKeySignInput');
const passphraseSignInput = document.getElementById('passphraseSignInput');
const useGeneratedPrivateKeySignBtn = document.getElementById('useGeneratedPrivateKeySignBtn');
const signError = document.getElementById('signError');
const signBtn = document.getElementById('signBtn');
const signedMessageOutput = document.getElementById('signedMessageOutput');

const verifyTool = document.getElementById('verifyTool');
const verifyInputSection = verifyTool.querySelector('.tool-input-section');
const verifyOutputSection = verifyTool.querySelector('.tool-output-section');
const signatureVerifyInput = document.getElementById('signatureVerifyInput');
const originalMessageVerifyInput = document.getElementById('originalMessageVerifyInput');
const publicKeyVerifyInput = document.getElementById('publicKeyVerifyInput');
const verifyError = document.getElementById('verifyError');
const verifyBtn = document.getElementById('verifyBtn');
const verifyResultOutput = document.getElementById('verifyResultOutput');

const revokeTool = document.getElementById('revokeTool');
const revokeInputSection = revokeTool.querySelector('.tool-input-section');
const revokeOutputSection = revokeTool.querySelector('.tool-output-section');
const revokeKeyInput = document.getElementById('revokeKeyInput');
const passphraseRevokeInput = document.getElementById('passphraseRevokeInput');
const useGeneratedPrivateKeyRevokeBtn = document.getElementById('useGeneratedPrivateKeyRevokeBtn');
const revokeError = document.getElementById('revokeError');
const revokeBtn = document.getElementById('revokeBtn');
const revokedPublicKeyOutput = document.getElementById('revokedPublicKeyOutput');
const revocationCertOutput = document.getElementById('revocationCertOutput');

let dotAnimationInterval;
let dotCount = 0;

function startGeneratingAnimation() {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating.';
    dotCount = 0;
    dotAnimationInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        let dots = '.'.repeat(dotCount);
        generateBtn.textContent = `Generating${dots}`;
    }, 300);
}

function stopGeneratingAnimation() {
    clearInterval(dotAnimationInterval);
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Key';
}

function showError(message, element = errorMsg) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => {
        if (element.textContent === message) {
            element.classList.remove('show');
            element.textContent = '';
        }
    }, 5000);
}

function showFieldError(el, errEl, msg) {
  errEl.textContent = msg;
  errEl.classList.add('show');
  el.setAttribute('aria-invalid', 'true');
}

function clearFieldError(el, errEl) {
  errEl.textContent = '';
  errEl.classList.remove('show');
  el.removeAttribute('aria-invalid');
}

function toggleToolSections(inputSection, outputSection, showOutput = true) {
    if (showOutput) {
        inputSection.classList.add('hidden-input');
        outputSection.classList.remove('hidden-output');
        const focusTarget = outputSection.querySelector('pre[tabindex="-1"]');
        if (focusTarget) {
            setTimeout(() => focusTarget.focus(), 100);
        }
    } else {
        outputSection.classList.add('hidden-output');
        inputSection.classList.remove('hidden-input');
    }
}

function copyToClipboard(text, button) {
    const originalText = button.textContent;
    if (!text) {
        showError("Nothing to copy!");
        return;
    }

    navigator.clipboard.writeText(text).then(() => {
        button.textContent = 'Copied!';
        button.disabled = true;
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 1500);
    }).catch(err => {
        console.error('Clipboard copy failed:', err);
        showError('Failed to copy to clipboard.');
    });
}

function downloadAsFile(content, filename, type) {
    if (!content) {
        showError("Nothing to download!");
        return;
    }
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function addUidField() {
    const uidContainer = document.getElementById('uidContainer');
    const newGroup = document.createElement('div');
    newGroup.className = 'uid-group';
    newGroup.innerHTML = `
        <div class="input-group">
            <label>Name (Optional)</label>
            <input type="text" name="name" placeholder="Another Name" class="js-resettable-input uid-input" />
        </div>
        <div class="input-group">
            <label>Email (Optional)</label>
            <input type="email" name="email" placeholder="Another Email" class="js-resettable-input uid-input" autocomplete="email" />
        </div>
    `;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.className = 'remove-uid-btn';
    removeBtn.title = 'Remove this identity';

    removeBtn.addEventListener('click', () => {
        newGroup.remove();
        validateUidInputs();
    });

    newGroup.appendChild(removeBtn);
    
    uidContainer.appendChild(newGroup);
    newGroup.querySelectorAll('.uid-input').forEach(input => {
        input.addEventListener('input', validateUidInputs);
    });
}

function validateUidInputs() {
    const uidInputs = document.querySelectorAll('.uid-input');
    let hasContent = false;
    uidInputs.forEach(input => {
        if (input.value.trim() !== '') {
            hasContent = true;
        }
    });
    generateBtn.disabled = !hasContent;
}

function handlePrintSafetySheet() {
    const { userIDs, keyId, fingerprint, expiration } = keyInfoForPrinting;
    const creationDate = new Date().toUTCString();
    
    let userIdsHtml = '';
    userIDs.forEach(uid => {
        userIdsHtml += `<li>${uid.name} &lt;${uid.email}&gt;</li>`;
    });

    const sheetHtml = `
        <html>
            <head>
                <title>PGP Key Safety Sheet</title>
                <style>
                    body { font-family: monospace; line-height: 1.6; }
                    .container { max-width: 800px; margin: 40px auto; padding: 20px; border: 1px solid #ccc; }
                    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
                    strong { display: inline-block; width: 120px; }
                    ul { padding-left: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>PGP Key Safety Sheet</h1>
                    <p><strong>Created On:</strong> ${creationDate}</p>
                    <p><strong>Expires On:</strong> ${expiration}</p>
                    <p><strong>Key ID:</strong> ${keyId}</p>
                    <p><strong>Fingerprint:</strong></p>
                    <pre>${fingerprint}</pre>
                    <h3>User Identities:</h3>
                    <ul>${userIdsHtml}</ul>
                    <hr>
                    <p>Store this document securely offline. Use the fingerprint to verify your key's authenticity.</p>
                </div>
            </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(sheetHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

document.addEventListener('DOMContentLoaded', () => {
    keyForm.addEventListener('submit', handleKeyGeneration);
    resetBtn.addEventListener('click', resetForm);
    advancedToggle.addEventListener('change', () => {
        advancedSection.classList.toggle('show', advancedToggle.checked);
        advancedToggleText.textContent = advancedToggle.checked ? 'Hide Advanced Options' : 'Show Advanced Options';
    });
    document.getElementById('keyType').addEventListener('change', (e) => {
        const type = e.target.value;
        document.getElementById('eccOptions').classList.toggle('hidden', type !== 'ecc');
        document.getElementById('rsaOptions').classList.toggle('hidden', type !== 'rsa');
    });

    document.getElementById('copyPublicBtn').addEventListener('click', (e) => copyToClipboard(publicKeyOutput.textContent, e.currentTarget));
    document.getElementById('downloadPublicBtn').addEventListener('click', () => downloadAsFile(publicKeyOutput.textContent, 'public-key.asc', 'application/pgp-keys'));
    document.getElementById('copyPrivateBtn').addEventListener('click', (e) => copyToClipboard(generatedKeys?.privateKey, e.currentTarget));
    document.getElementById('downloadPrivateBtn').addEventListener('click', () => downloadAsFile(generatedKeys?.privateKey, 'private-key.asc', 'application/pgp-keys'));
    forgetPrivateKeyBtn.addEventListener('click', forgetPrivateKey);
    document.getElementById('addUidBtn').addEventListener('click', addUidField);
    document.getElementById('printSafetySheetBtn').addEventListener('click', handlePrintSafetySheet);
    document.querySelectorAll('.uid-input').forEach(input => {
        input.addEventListener('input', validateUidInputs);
    });

    toggleToolsBtn.addEventListener('click', handleToggleTools);
    singleBackToToolsBtn.addEventListener('click', handleBackToTools);

    toolCategoryButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target;
            showTool(targetId);
        });
    });

    backToToolInputButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetToolId = e.target.dataset.targetTool;
            const toolContainer = document.getElementById(targetToolId);
            if (toolContainer) {
                const inputSection = toolContainer.querySelector('.tool-input-section');
                const outputSection = toolContainer.querySelector('.tool-output-section');
                toggleToolSections(inputSection, outputSection, false);
            }
        });
    });

    encryptBtn.addEventListener('click', handleEncrypt);
    useGeneratedPublicKeyBtn.addEventListener('click', () => {
        if (generatedKeys?.publicKey) {
            publicKeyEncryptInput.value = generatedKeys.publicKey;
        } else {
            showError("No key has been generated yet.", encryptError);
        }
    });
    document.getElementById('copyEncryptedBtn').addEventListener('click', (e) => copyToClipboard(encryptedMessageOutput.textContent, e.currentTarget));
    document.getElementById('downloadEncryptedBtn').addEventListener('click', () => downloadAsFile(encryptedMessageOutput.textContent, 'encrypted_message.asc', 'application/pgp-encrypted'));

    decryptBtn.addEventListener('click', handleDecrypt);
    useGeneratedPrivateKeyBtn.addEventListener('click', () => {
        if (generatedKeys?.privateKey) {
            privateKeyDecryptInput.value = generatedKeys.privateKey;
        } else {
            showError("No private key is available. It may have been cleared for security.", decryptError);
        }
    });
    document.getElementById('copyDecryptedBtn').addEventListener('click', (e) => copyToClipboard(decryptedMessageOutput.textContent, e.currentTarget));

    signBtn.addEventListener('click', handleSign);
    useGeneratedPrivateKeySignBtn.addEventListener('click', () => {
        if (generatedKeys?.privateKey) {
            privateKeySignInput.value = generatedKeys.privateKey;
        } else {
            showError("No private key is available. It may have been cleared for security.", signError);
        }
    });
    document.getElementById('copySignedBtn').addEventListener('click', (e) => copyToClipboard(signedMessageOutput.textContent, e.currentTarget));
    document.getElementById('downloadSignedBtn').addEventListener('click', () => downloadAsFile(signedMessageOutput.textContent, 'signed_message.asc', 'application/pgp-signature'));

    verifyBtn.addEventListener('click', handleVerify);

    revokeBtn.addEventListener('click', handleRevoke);
    useGeneratedPrivateKeyRevokeBtn.addEventListener('click', () => {
        if (generatedKeys?.privateKey) {
            revokeKeyInput.value = generatedKeys.privateKey;
        } else {
            showError("No private key is available. It may have been cleared for security.", revokeError);
        }
    });
    document.getElementById('copyRevokedPublicKeyBtn').addEventListener('click', (e) => copyToClipboard(revokedPublicKeyOutput.textContent, e.currentTarget));
    document.getElementById('downloadRevokedPublicKeyBtn').addEventListener('click', () => downloadAsFile(revokedPublicKeyOutput.textContent, 'revoked-public-key.asc', 'application/pgp-keys'));
    document.getElementById('copyRevokeCertBtn').addEventListener('click', (e) => copyToClipboard(revocationCertOutput.textContent, e.currentTarget));
    document.getElementById('downloadRevokeCertBtn').addEventListener('click', () => downloadAsFile(revocationCertOutput.textContent, 'revocation-certificate.asc', 'application/pgp-keys'));

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    resetForm();
});

async function handleKeyGeneration(e) {
    e.preventDefault();

    const uidGroups = document.querySelectorAll('.uid-group');
    const userIDs = [];
    uidGroups.forEach(group => {
        const name = group.querySelector('input[name="name"]').value.trim();
        const email = group.querySelector('input[name="email"]').value.trim();
        if (name || email) {
            userIDs.push({ name, email });
        }
    });
    
    const emailEl = document.getElementById('email');
    const emailErr = document.getElementById('emailError');

    const type = document.getElementById('keyType').value;
    const curve = document.getElementById('eccCurve').value;
    const size = parseInt(document.getElementById('keySize').value);
    const passphrase = document.getElementById('passphrase').value;
    const generateSubkeys = subkeysToggle.checked;
    
    const rawExpiration = parseInt(document.getElementById('expiration').value);
    const exp = rawExpiration || undefined; 

    errorMsg.textContent = '';
    errorMsg.classList.remove('show');
    clearFieldError(emailEl, emailErr);

    if (userIDs.length === 0) {
        showError("Please provide at least one Name or Email.");
        return;
    }
    
    let hasInvalidEmail = false;
    userIDs.forEach(uid => {
        if (uid.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uid.email)) {
            showError(`Invalid email format for: ${uid.email}`);
            hasInvalidEmail = true;
        }
    });
    if (hasInvalidEmail) return;

    startGeneratingAnimation();

    const options = {
        type,
        userIDs,
        keyExpirationTime: exp, 
        passphrase: passphrase || undefined,
        format: 'armored'
    };

    if (type === 'ecc') {
        options.curve = curve;
    } else {
        options.rsaBits = size;
    }

    if (generateSubkeys) {
        if (type === 'ecc') {
            options.subkeys = [
                { type: 'ecc', curve: 'curve25519', usage: ['encrypt'], keyExpirationTime: exp }, // Use normalized value
                { type: 'ecc', curve: 'ed25519', usage: ['sign'], keyExpirationTime: exp } // Use normalized value
            ];
        } else {
            options.subkeys = [
                { type: 'rsa', rsaBits: size, usage: ['encrypt'], keyExpirationTime: exp }, // Use normalized value
                { type: 'rsa', rsaBits: size, usage: ['sign'], keyExpirationTime: exp } // Use normalized value
            ];
        }
    }

    try {
        const { privateKey, publicKey } = await openpgp.generateKey(options);
        generatedKeys = { privateKey, publicKey };

        publicKeyOutput.textContent = publicKey;

        const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
        const keyId = publicKeyObj.getKeyID().toHex().toUpperCase();
        const fingerprint = publicKeyObj.getFingerprint().toUpperCase();
        
        keyIdOutput.textContent = keyId;
        fingerprintOutput.textContent = fingerprint;

        const expirationDate = await publicKeyObj.getExpirationTime();
        let expirationString = 'Never';
        if (expirationDate instanceof Date) {
            expirationString = expirationDate.toUTCString();
        }

        keyInfoForPrinting = {
            userIDs,
            keyId,
            fingerprint,
            expiration: expirationString
        };
        
        keyGenOutputSection.querySelectorAll('.js-action-button').forEach(btn => btn.disabled = false);
        privateKeyNote.innerHTML = `<strong>Your private key is not shown here for security.</strong> Use the buttons below to copy it to your clipboard or download it as a file. Store it safely offline.`;


        toggleToolSections(keyGenInputSection, keyGenOutputSection, true);
    } catch (err) {
        console.error("PGP key generation failed:", err);
        showError("Key generation failed. Check console for details.");
    } finally {
        stopGeneratingAnimation();
    }
}

async function handleEncrypt() {
    const message = encryptMessageInput.value;
    const publicKeyArmored = publicKeyEncryptInput.value.trim();
    encryptError.textContent = '';
    if (!message || !publicKeyArmored) {
        return;
    }
    encryptedMessageOutput.textContent = 'Encrypting...';
    toggleToolSections(encryptInputSection, encryptOutputSection, true);
    try {
        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
        const encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: message }),
            encryptionKeys: publicKey,
            format: 'armored'
        });
        encryptedMessageOutput.textContent = encrypted;
        encryptOutputSection.querySelector('#copyEncryptedBtn').disabled = false;
        encryptOutputSection.querySelector('#downloadEncryptedBtn').disabled = false;
    } catch (err) {
        console.error("Encryption error:", err);
        showError("Encryption failed. Check the public key and console.", encryptError);
        toggleToolSections(encryptInputSection, encryptOutputSection, false);
    }
}

async function handleDecrypt() {
    const encryptedMessage = decryptMessageInput.value.trim();
    const privateKeyArmored = privateKeyDecryptInput.value.trim();
    const passphrase = passphraseDecryptInput.value;
    decryptError.textContent = '';
    if (!encryptedMessage || !privateKeyArmored) {
        return;
    }
    decryptedMessageOutput.textContent = 'Decrypting...';
    toggleToolSections(decryptInputSection, decryptOutputSection, true);
    try {
        const message = await openpgp.readMessage({ armoredMessage: encryptedMessage });
        let privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
        
        if (privateKey.isDecrypted() === false && !passphrase) {
            showError("This private key requires a passphrase.", decryptError);
            toggleToolSections(decryptInputSection, decryptOutputSection, false);
            return;
        }

        if (!privateKey.isDecrypted() && passphrase) {
            privateKey = await openpgp.decryptKey({ privateKey, passphrase });
        }

        const { data: decrypted } = await openpgp.decrypt({
            message,
            decryptionKeys: privateKey,
        });
        decryptedMessageOutput.textContent = decrypted;
        decryptOutputSection.querySelector('#copyDecryptedBtn').disabled = false;
    } catch (err) {
        console.error("Decryption error:", err);
        showError("Decryption failed. Check private key, passphrase, and console.", decryptError);
        toggleToolSections(decryptInputSection, decryptOutputSection, false);
    }
}

async function handleSign() {
    const messageText = signMessageInput.value;
    const privateKeyArmored = privateKeySignInput.value.trim();
    const passphrase = passphraseSignInput.value;
    signError.textContent = '';
    if (!messageText || !privateKeyArmored) {
        return;
    }
    signedMessageOutput.textContent = 'Signing...';
    toggleToolSections(signInputSection, signOutputSection, true);
    try {
        const message = await openpgp.createMessage({ text: messageText });
        let privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });

        if (privateKey.isDecrypted() === false && !passphrase) {
            showError("This private key requires a passphrase.", signError);
            toggleToolSections(signInputSection, signOutputSection, false);
            return;
        }

        if (!privateKey.isDecrypted() && passphrase) {
            privateKey = await openpgp.decryptKey({ privateKey, passphrase });
        }

        const signed = await openpgp.sign({
            message,
            signingKeys: privateKey,
            format: 'armored'
        });
        signedMessageOutput.textContent = signed;
        signOutputSection.querySelector('#copySignedBtn').disabled = false;
        signOutputSection.querySelector('#downloadSignedBtn').disabled = false;
    } catch (err) {
        console.error("Signing error:", err);
        showError("Signing failed. Check private key, passphrase, and console.", signError);
        toggleToolSections(signInputSection, signOutputSection, false);
    }
}

async function handleVerify() {
    const signatureArmored = signatureVerifyInput.value.trim();
    const originalMessageText = originalMessageVerifyInput.value.trim();
    const publicKeyArmored = publicKeyVerifyInput.value.trim();

    verifyError.textContent = '';
    if (!signatureArmored || !publicKeyArmored) {
        return;
    }

    verifyResultOutput.textContent = 'Verifying...';
    verifyResultOutput.classList.remove('text-valid', 'text-invalid');
    toggleToolSections(verifyInputSection, verifyOutputSection, true);
    try {
        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
        let verificationResult;

        if (originalMessageText) {
            const signature = await openpgp.readSignature({ armoredSignature: signatureArmored });
            const message = await openpgp.createMessage({ text: originalMessageText });
            verificationResult = await openpgp.verify({
                message,
                signature,
                verificationKeys: publicKey
            });
        } else {
            const signedMessage = await openpgp.readMessage({ armoredMessage: signatureArmored });
            verificationResult = await openpgp.verify({
                message: signedMessage,
                verificationKeys: publicKey
            });
        }
        
        if (verificationResult.signatures.length === 0) {
            throw new Error("No valid PGP signature found in the provided message.");
        }

        const { verified, keyID } = verificationResult.signatures[0];
        await verified;

        const signerUserID = publicKey.getUserIDs()[0] || 'N/A';
        const fingerprint = publicKey.getFingerprint().toUpperCase();

        verifyResultOutput.textContent = `✅ SIGNATURE VALID\n\n` +
            `Signed by: ${signerUserID}\n` +
            `Key ID: ${keyID.toHex().toUpperCase()}\n` +
            `Fingerprint: ${fingerprint}\n\n` +
            `IMPORTANT: Manually verify that this fingerprint belongs to the person you expect.`;
        verifyResultOutput.classList.add('text-valid');

    } catch (err) {
        console.error("Verification error:", err);
        verifyResultOutput.textContent = `❌ SIGNATURE INVALID\n\n${err.message || 'The signature could not be verified.'}`;
        verifyResultOutput.classList.add('text-invalid');
    }
}

async function handleRevoke() {
  const privateKeyArmored = revokeKeyInput.value.trim();
  const passphrase = passphraseRevokeInput.value;
  revokeError.textContent = '';

  if (!privateKeyArmored) {
    showError("Private Key is required.", revokeError);
    return;
  }

  revocationCertOutput.textContent = 'Generating...';
  revokedPublicKeyOutput.textContent = 'Generating...';
  toggleToolSections(revokeInputSection, revokeOutputSection, true);

  try {
    let keyObj = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });

    if (passphrase) {
      keyObj = await openpgp.decryptKey({ privateKey: keyObj, passphrase });
    }

    const { publicKey: revokedKeyArmored } = await openpgp.revokeKey({
      key: keyObj,
      format: 'armored'
    });
    revokedPublicKeyOutput.textContent = revokedKeyArmored;

    const revokedKeyObj = await openpgp.readKey({ armoredKey: revokedKeyArmored });
    const cert = await revokedKeyObj.getRevocationCertificate();
    revocationCertOutput.textContent = cert;

    document.getElementById('copyRevokedPublicKeyBtn').disabled = false;
    document.getElementById('downloadRevokedPublicKeyBtn').disabled = false;
    document.getElementById('copyRevokeCertBtn').disabled = false;
    document.getElementById('downloadRevokeCertBtn').disabled = false;

  } catch (err) {
    console.error("Revocation error:", err);
    showError("Revocation failed. Check key, passphrase, and console.", revokeError);
    toggleToolSections(revokeInputSection, revokeOutputSection, false);
  }
}

function resetForm() {
    keyForm.reset();
    
    generatedKeys = null;
    keyInfoForPrinting = {};

    const uidContainer = document.getElementById('uidContainer');
    uidContainer.innerHTML = `
        <div class="uid-group">
            <div class="input-group">
                <label for="name">Name</label>
                <input type="text" id="name" name="name" placeholder="Your Name" class="js-resettable-input uid-input" aria-describedby="nameError" />
            </div>
            <div class="input-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" placeholder="Your Email" class="js-resettable-input uid-input" aria-describedby="emailError" autocomplete="email" />
            </div>
        </div>
    `;
    document.querySelectorAll('.uid-input').forEach(input => {
        input.addEventListener('input', validateUidInputs);
    });
    validateUidInputs();


    publicKeyOutput.textContent = '';
    keyIdOutput.textContent = 'N/A';
    fingerprintOutput.textContent = 'N/A';
    privateKeyNote.innerHTML = `<strong>Your private key is not shown here for security.</strong> Use the buttons below to copy it to your clipboard or download it as a file. Store it safely offline.`;


    document.querySelectorAll('#pgpToolWrapper .js-resettable-input').forEach(input => input.value = '');

    document.querySelectorAll('.js-resettable-output').forEach(output => {
        output.textContent = '';
        output.classList.remove('text-valid', 'text-invalid');
    });
    document.querySelectorAll('.error-msg').forEach(msg => {
        msg.textContent = '';
        msg.classList.remove('show');
    });

    document.querySelectorAll('.js-action-button').forEach(btn => btn.disabled = true);

    toolItemContainers.forEach(container => {
        const inputSection = container.querySelector('.tool-input-section');
        const outputSection = container.querySelector('.tool-output-section');
        if (inputSection && outputSection) {
            toggleToolSections(inputSection, outputSection, false);
        }
    });
    toggleToolSections(keyGenInputSection, keyGenOutputSection, false);

    keyGenerationWrapper.classList.remove('hidden-section');
    pgpToolWrapper.classList.remove('visible-section');
    toggleToolsBtn.textContent = 'Show PGP Tools';
    toolsCategorySelector.classList.add('hidden-buttons');
    toolItemContainers.forEach(container => {
        container.classList.remove('visible-tool');
    });
    singleBackToToolsBtn.classList.add('hidden');
    
    document.getElementById('keyType').dispatchEvent(new Event('change'));
    advancedSection.classList.remove('show');
    advancedToggle.checked = false;
    advancedToggleText.textContent = 'Show Advanced Options';
}

function handleToggleTools() {
    const isToolsVisible = pgpToolWrapper.classList.contains('visible-section');
    if (isToolsVisible) {
        pgpToolWrapper.classList.remove('visible-section');
        keyGenerationWrapper.classList.remove('hidden-section');
        toggleToolsBtn.textContent = 'Show PGP Tools';
        toolsCategorySelector.classList.add('hidden-buttons');
        toolItemContainers.forEach(container => container.classList.remove('visible-tool'));
        singleBackToToolsBtn.classList.add('hidden');
    } else {
        keyGenerationWrapper.classList.add('hidden-section');
        pgpToolWrapper.classList.add('visible-section');
        toggleToolsBtn.textContent = 'Hide PGP Tools';
        toolsCategorySelector.classList.remove('hidden-buttons');
    }
}

function showTool(targetId) {
    const targetContainer = document.getElementById(targetId);
    toolsCategorySelector.classList.add('hidden-buttons');
    toolItemContainers.forEach(container => {
        container.classList.remove('visible-tool');
    });
    targetContainer.classList.add('visible-tool');
    singleBackToToolsBtn.classList.remove('hidden');
}

function handleBackToTools() {
    toolItemContainers.forEach(container => {
        container.classList.remove('visible-tool');
    });
    toolsCategorySelector.classList.remove('hidden-buttons');
    singleBackToToolsBtn.classList.add('hidden');
}

function forgetPrivateKey() {
    if (generatedKeys) {
        generatedKeys.privateKey = null;
    }
    document.getElementById('copyPrivateBtn').disabled = true;
    document.getElementById('downloadPrivateBtn').disabled = true;
    forgetPrivateKeyBtn.disabled = true;

    useGeneratedPrivateKeyBtn.disabled = true;
    useGeneratedPrivateKeySignBtn.disabled = true;
    useGeneratedPrivateKeyRevokeBtn.disabled = true;

    privateKeyNote.textContent = 'Private key has been cleared from memory for security.';
}

function handleVisibilityChange() {
    if (document.hidden && generatedKeys?.privateKey) {
        forgetPrivateKey();
        privateKeyNote.textContent = 'Private key was cleared for security because you switched tabs.';
    }
}

function handleBeforeUnload(e) {
    if (generatedKeys?.privateKey) {
        e.preventDefault();
        e.returnValue = 'You have an active private key that has not been saved. Are you sure you want to leave?';
        return e.returnValue;
    }
}
