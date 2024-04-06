const vscode = require('vscode');
const { OpenAI } = require('openai');


function getApiKey() {
    const config = vscode.workspace.getConfiguration('llmacros');
    const apiKey = config.get('apiSecretKey');
    return apiKey;
}

async function queryLLMWithContext(apiKey, prompt, format, context_pre, context_post, text) {
    const openai = new OpenAI({ 'apiKey': apiKey });

    try {
        console.log('queryLLMWithContext', prompt, format, context_pre, context_post, text);
        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: prompt },
                { role: 'assistant', content: 'For context, format of input?' },
                { role: 'user', content: format },
                { role: 'assistant', content: 'For context, up to 1000 characters immediately preceding input?' },
                { role: 'user', content: context_pre },
                { role: 'assistant', content: 'For context, up to 1000 characters immediately following input?' },
                { role: 'user', content: context_post },
                { role: 'assistant', content: 'Input text?' },
                { role: 'user', content: text },
            ],
            model: 'gpt-3.5-turbo',
        });
        return completion.choices[0].message.content;

    } catch (error) {
        console.log('error', error);
        vscode.window.showErrorMessage(error);
        return null;
    }
}

function getTextBeforeSelection(textEditor, maxLength) {
    const selection = textEditor.selection;
    const fullText = textEditor.document.getText(new vscode.Range(new vscode.Position(0, 0), selection.start));
    return fullText.substring(Math.max(fullText.length - maxLength, 0));
}

function getEndOfDocumentPosition(textEditor) {
    const document = textEditor.document;
    const lastLine = document.lineCount - 1;
    const endLine = document.lineAt(lastLine);
    const endCharacter = endLine.range.end.character;
    return new vscode.Position(lastLine, endCharacter);
}

function getTextAfterSelection(textEditor, maxLength) {
    const selection = textEditor.selection;
    const fullText = textEditor.document.getText(new vscode.Range(selection.end, getEndOfDocumentPosition(textEditor)));
    return fullText.substring(0, Math.min(maxLength, fullText.length));
}

async function editSelectionWithContext(textEditor, prompt) {
    const apiKey = getApiKey();
    if (!apiKey) {
        vscode.window.showErrorMessage('Please configure OpenAI API secret key!');
        return;
    }

    const format = textEditor.document.languageId;
    const context_pre = getTextBeforeSelection(textEditor, 1000);
    const context_post = getTextAfterSelection(textEditor, 1000);
    const selectedText = textEditor.document.getText(textEditor.selection);
    const improvedText = await queryLLMWithContext(apiKey, prompt, format, context_pre, context_post, selectedText);

    if (improvedText) {
        textEditor.edit(editBuilder => {
            editBuilder.replace(selection, improvedText);
        });
    } else {
        vscode.window.showErrorMessage('Error querying LLM. Please try again!');
    }
}


function activate(context) {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('llmacros.doImproveIdiomaticness', async (textEditor) => {
        return await editSelectionWithContext(textEditor, 'Improve idiomaticness of input text provided by user, while not alterating its meaning. When in doubt, stay close to input text. Output nothing but improved version of input text.');
    }));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand('llmacros.doShorten20', async (textEditor) => {
        return await editSelectionWithContext(textEditor, 'Shorten input text provided by user by ~20%, while not alterating its meaning. When in doubt, stay close to input text. Output nothing but improved version of input text.');
    }));
}


function deactivate() { }


module.exports = {
    activate,
    deactivate
};

