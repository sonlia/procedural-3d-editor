export function isFunctionParam(label) {
    if (typeof label !== 'string') return false;
    return /\w+\(.*\)/.test(label);
}

export function parseFunctionSignature(signature) {
    if (typeof signature !== 'string') return { name: '', args: [] };
    const match = signature.match(/(\w+)\((.*)\)/);
    if (!match) return { name: signature, args: [] };
    const name = match[1];
    const args = match[2] ? match[2].split(',').map(s => s.trim()) : [];
    return { name, args };
}
