// This file runs at the very beginning of the application
// It ensures the Ant Design patch is loaded before any other code
export async function register() {
    if (typeof window !== "undefined") {
        // Load the patch on the client side
        await import("@ant-design/v5-patch-for-react-19");
    }
}

