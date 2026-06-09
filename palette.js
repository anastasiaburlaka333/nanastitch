// DMC Color Palette Subset (Common colors)
window.DMC_COLORS = [
    { code: "310", name: "Black", r: 0, g: 0, b: 0, hex: "#000000" },
    { code: "BLANC", name: "White", r: 255, g: 255, b: 255, hex: "#FFFFFF" },
    { code: "666", name: "Christmas Red - BR", r: 227, g: 11, b: 0, hex: "#E30B00" },
    { code: "796", name: "Royal Blue - DK", r: 0, g: 60, b: 120, hex: "#003C78" },
    { code: "905", name: "Parrot Green - DK", r: 59, g: 104, b: 4, hex: "#3B6804" },
    { code: "444", name: "Lemon - DK", r: 255, g: 212, b: 0, hex: "#FFD400" },
    { code: "606", name: "Bright Orange-Red", r: 250, g: 44, b: 0, hex: "#FA2C00" },
    { code: "550", name: "Violet - VY DK", r: 92, g: 1, b: 121, hex: "#5C0179" },
    { code: "307", name: "Lemon", r: 253, g: 236, b: 42, hex: "#FDEC2A" },
    { code: "995", name: "Electric Blue - DK", r: 35, g: 140, b: 191, hex: "#238CBF" },
    { code: "702", name: "Kelly Green", r: 71, g: 154, b: 18, hex: "#479A12" },
    { code: "815", name: "Garnet - MD", r: 135, g: 14, b: 38, hex: "#870E26" },
    { code: "3843", name: "Electric Blue", r: 0, g: 161, b: 206, hex: "#00A1CE" },
    { code: "321", name: "Red", r: 196, g: 1, b: 31, hex: "#C4011F" },
    { code: "743", name: "Yellow - MD", r: 255, g: 200, b: 73, hex: "#FFC849" },
    { code: "700", name: "Christmas Green - BR", r: 0, g: 112, b: 23, hex: "#007017" },
    { code: "3371", name: "Black Brown", r: 30, g: 13, b: 1, hex: "#1E0D01" },
    { code: "898", name: "Coffee Brown - VY DK", r: 73, g: 44, b: 21, hex: "#492C15" },
    { code: "434", name: "Brown - LT", r: 149, g: 84, b: 38, hex: "#955426" },
    { code: "742", name: "Light Tangerine", r: 255, g: 163, b: 43, hex: "#FFA32B" },
];

window.findClosestDMC = function(r, g, b) {
    let minDistance = Infinity;
    let closest = window.DMC_COLORS[0];

    for (const color of window.DMC_COLORS) {
        const d = Math.sqrt(
            Math.pow(r - color.r, 2) +
            Math.pow(g - color.g, 2) +
            Math.pow(b - color.b, 2)
        );
        if (d < minDistance) {
            minDistance = d;
            closest = color;
        }
    }
    return closest;
};
