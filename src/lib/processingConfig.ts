/**
 * Processing Methods and Models Configuration
 * Frontend configuration matching backend processingConfig.js
 */

export const PROCESSING_METHODS = {
    OPENAI: 'openai',
    QWEN: 'qwen'
} as const;

export const OPENAI_MODELS = {
    GPT_4O: 'gpt-4o',
    GPT_4O_2024_08_06: 'gpt-4o-2024-08-06',
    GPT_4: 'gpt-4',
    GPT_3_5_TURBO: 'gpt-3.5-turbo'
} as const;

export const QWEN_MODELS = {
    // Qwen-Max series (best quality)
    QWEN3_MAX: 'qwen3-max',
    QWEN3_MAX_2025_09_23: 'qwen3-max-2025-09-23',
    QWEN3_MAX_PREVIEW: 'qwen3-max-preview',
    QWEN_MAX: 'qwen-max',
    QWEN_MAX_LATEST: 'qwen-max-latest',
    QWEN_MAX_2025_01_25: 'qwen-max-2025-01-25',
    
    // Qwen-Plus series
    QWEN_PLUS: 'qwen-plus',
    QWEN_PLUS_LATEST: 'qwen-plus-latest',
    QWEN_PLUS_2025_01_25: 'qwen-plus-2025-01-25',
    
    // Qwen-Flash series (faster)
    QWEN_FLASH: 'qwen-flash',
    QWEN_FLASH_2025_07_28: 'qwen-flash-2025-07-28',
    
    // Qwen-Turbo series (fastest)
    QWEN_TURBO: 'qwen-turbo',
    QWEN_TURBO_LATEST: 'qwen-turbo-latest',
    QWEN_TURBO_2024_11_01: 'qwen-turbo-2024-11-01',
    
    // Qwen-Coder series
    QWEN3_CODER_PLUS: 'qwen3-coder-plus',
    QWEN3_CODER_PLUS_2025_07_22: 'qwen3-coder-plus-2025-07-22',
    QWEN3_CODER_FLASH: 'qwen3-coder-flash',
    QWEN3_CODER_FLASH_2025_07_28: 'qwen3-coder-flash-2025-07-28'
} as const;

// Arrays of all available models
export const OPENAI_MODELS_LIST = Object.values(OPENAI_MODELS);
export const QWEN_MODELS_LIST = Object.values(QWEN_MODELS);
export const ALL_PROCESSING_METHODS = Object.values(PROCESSING_METHODS);

// Default models for each method
export const DEFAULT_MODELS = {
    [PROCESSING_METHODS.OPENAI]: OPENAI_MODELS.GPT_4O,
    [PROCESSING_METHODS.QWEN]: QWEN_MODELS.QWEN3_MAX
} as const;

// Model display names for UI
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
    // OpenAI
    [OPENAI_MODELS.GPT_4O]: 'GPT-4o',
    [OPENAI_MODELS.GPT_4O_2024_08_06]: 'GPT-4o (2024-08-06)',
    [OPENAI_MODELS.GPT_4]: 'GPT-4',
    [OPENAI_MODELS.GPT_3_5_TURBO]: 'GPT-3.5 Turbo',
    
    // Qwen
    [QWEN_MODELS.QWEN3_MAX]: 'Qwen3-Max (Recommended)',
    [QWEN_MODELS.QWEN3_MAX_2025_09_23]: 'Qwen3-Max (2025-09-23)',
    [QWEN_MODELS.QWEN3_MAX_PREVIEW]: 'Qwen3-Max (Preview)',
    [QWEN_MODELS.QWEN_MAX]: 'Qwen-Max',
    [QWEN_MODELS.QWEN_MAX_LATEST]: 'Qwen-Max (Latest)',
    [QWEN_MODELS.QWEN_MAX_2025_01_25]: 'Qwen-Max (2025-01-25)',
    [QWEN_MODELS.QWEN_PLUS]: 'Qwen-Plus',
    [QWEN_MODELS.QWEN_PLUS_LATEST]: 'Qwen-Plus (Latest)',
    [QWEN_MODELS.QWEN_PLUS_2025_01_25]: 'Qwen-Plus (2025-01-25)',
    [QWEN_MODELS.QWEN_FLASH]: 'Qwen-Flash',
    [QWEN_MODELS.QWEN_FLASH_2025_07_28]: 'Qwen-Flash (2025-07-28)',
    [QWEN_MODELS.QWEN_TURBO]: 'Qwen-Turbo',
    [QWEN_MODELS.QWEN_TURBO_LATEST]: 'Qwen-Turbo (Latest)',
    [QWEN_MODELS.QWEN_TURBO_2024_11_01]: 'Qwen-Turbo (2024-11-01)',
    [QWEN_MODELS.QWEN3_CODER_PLUS]: 'Qwen3-Coder-Plus',
    [QWEN_MODELS.QWEN3_CODER_PLUS_2025_07_22]: 'Qwen3-Coder-Plus (2025-07-22)',
    [QWEN_MODELS.QWEN3_CODER_FLASH]: 'Qwen3-Coder-Flash',
    [QWEN_MODELS.QWEN3_CODER_FLASH_2025_07_28]: 'Qwen3-Coder-Flash (2025-07-28)'
};

// Method display names
export const METHOD_DISPLAY_NAMES: Record<string, string> = {
    [PROCESSING_METHODS.OPENAI]: 'OpenAI',
    [PROCESSING_METHODS.QWEN]: 'Qwen (Alibaba Cloud)'
};

/**
 * Get available models for a processing method
 */
export function getModelsForMethod(method: string): string[] {
    if (method === PROCESSING_METHODS.OPENAI) {
        return OPENAI_MODELS_LIST;
    } else if (method === PROCESSING_METHODS.QWEN) {
        return QWEN_MODELS_LIST;
    }
    return [];
}

/**
 * Get default model for a processing method
 */
export function getDefaultModel(method: string): string {
    return DEFAULT_MODELS[method as keyof typeof DEFAULT_MODELS] || '';
}

/**
 * Get display name for a model
 */
export function getModelDisplayName(model: string): string {
    return MODEL_DISPLAY_NAMES[model] || model;
}

/**
 * Get display name for a method
 */
export function getMethodDisplayName(method: string): string {
    return METHOD_DISPLAY_NAMES[method] || method;
}

