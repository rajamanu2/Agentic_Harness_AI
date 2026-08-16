# ForgeOS API

The ForgeOS extension exposes an API that can be used by other extensions. To use this API in your extension:

1. Copy `src/extension-api/forgeos.d.ts` to your extension's source directory.
2. Include `forgeos.d.ts` in your extension's compilation.
3. Get access to the API with the following code:

    ```ts
    const forgeosExtension = vscode.extensions.getExtension<ForgeOSAPI>("saoudrizwan.claude-dev")

    if (!forgeosExtension?.isActive) {
    	throw new Error("ForgeOS extension is not activated")
    }

    const forgeos = forgeosExtension.exports

    if (forgeos) {
    	// Now you can use the API

    	// Start a new task with an initial message
    	await forgeos.startNewTask("Hello, ForgeOS! Let's make a new project...")

    	// Start a new task with an initial message and images
    	await forgeos.startNewTask("Use this design language", ["data:image/webp;base64,..."])

    	// Send a message to the current task
    	await forgeos.sendMessage("Can you fix the @problems?")

    	// Simulate pressing the primary button in the chat interface (e.g. 'Save' or 'Proceed While Running')
    	await forgeos.pressPrimaryButton()

    	// Simulate pressing the secondary button in the chat interface (e.g. 'Reject')
    	await forgeos.pressSecondaryButton()
    } else {
    	console.error("ForgeOS API is not available")
    }
    ```

    **Note:** To ensure that the `saoudrizwan.claude-dev` extension is activated before your extension, add it to the `extensionDependencies` in your `package.json`:

    ```json
    "extensionDependencies": [
        "saoudrizwan.claude-dev"
    ]
    ```

For detailed information on the available methods and their usage, refer to the `forgeos.d.ts` file.
