document.addEventListener("DOMContentLoaded", () => {
    const categorySelect = document.getElementById("category");
    const fromUnitSelect = document.getElementById("fromUnit");
    const toUnitSelect = document.getElementById("toUnit");
    const fromUnitFilter = document.getElementById("fromUnitFilter");
    const toUnitFilter = document.getElementById("toUnitFilter");
    const inputValue = document.getElementById("inputValue");
    const resultEl = document.getElementById("result");
    const flipIcon = document.getElementById("flipIcon");
    const copyPopup = document.getElementById("copyPopup");
    const resultWrapper = document.querySelector(".result-wrapper");
    const container = document.querySelector(".container");
    const clearInputButton = document.getElementById("clearInput");
    const clearFromUnitButton = document.getElementById("clearFromUnit");
    const clearToUnitButton = document.getElementById("clearToUnit");
    const inputFeedback = document.getElementById("inputFeedback");

    const TEMP_CONVERSION_CONSTANT_9_5 = new Decimal(9).dividedBy(5);
    const TEMP_CONVERSION_CONSTANT_5_9 = new Decimal(5).dividedBy(9);
    const KELVIN_OFFSET = new Decimal(273.15);

    let lastCalculatedRawResult = null;
    let currentFromUnit = '';
    let currentToUnit = '';

    function createOption(label) {
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = label;
        return opt;
    }

    function populateCategories() {
        categorySelect.innerHTML = "";
        const sortedCategories = Object.keys(unitsData)
            .filter(category => typeof unitsData[category] === "object")
            .sort();

        sortedCategories.forEach(category => {
            categorySelect.appendChild(createOption(category));
        });
    }

    function populateUnits(selectElement, unitFilterElement, clearButtonElement, intendedSelection = null) {
        const category = categorySelect.value;
        const units = unitsData[category];
        selectElement.innerHTML = "";
        
        if (unitFilterElement.value.trim() !== '') {
            clearButtonElement.classList.add('visible');
        } else {
            clearButtonElement.classList.remove('visible');
        }

        let unitLabels = [];

        if (category === "Temperature") {
            unitLabels = ["Celsius", "Fahrenheit", "Kelvin"];
        } else {
            unitLabels = Object.keys(units);
        }

        const filteredText = unitFilterElement.value.toLowerCase();
        const filteredUnits = unitLabels.filter(label => label.toLowerCase().includes(filteredText));

        if (filteredUnits.length === 0) {
            selectElement.innerHTML = '<option value="no-match">No match found</option>';
            selectElement.classList.add('no-match-found');
            selectElement.disabled = true;
            return;
        } else {
            selectElement.classList.remove('no-match-found');
            selectElement.disabled = false;
            hideFeedback();
        }

        filteredUnits.forEach(label => {
            selectElement.appendChild(createOption(label));
        });

        if (intendedSelection && filteredUnits.includes(intendedSelection)) {
            selectElement.value = intendedSelection;
        } else if (selectElement.options.length > 0) {
            if (selectElement === fromUnitSelect) {
                selectElement.selectedIndex = 0;
            } else {
                if (selectElement.options.length > 1 && fromUnitSelect.value === selectElement.options[0].value) {
                    selectElement.selectedIndex = 1;
                } else {
                    selectElement.selectedIndex = 0;
                }
            }
        }
        
        if (selectElement === fromUnitSelect) {
            currentFromUnit = selectElement.value;
        } else {
            currentToUnit = selectElement.value;
        }
        convertUnits();
    }

    function formatSmart(value) {
        let formatted;
        const category = categorySelect.value;

        if (category === "Area" || category === "Angle" || category === "Cooking") {
            if (value instanceof Decimal) {
                formatted = value.toFixed(2);
            } else {
                formatted = Number(value).toFixed(2);
            }
            if (formatted.endsWith('.00')) {
                formatted = formatted.slice(0, -3);
            }
        } else {
            if (value instanceof Decimal) {
                formatted = value.toFixed(20);
            } else {
                formatted = Number(value).toFixed(20);
            }
            formatted = formatted.replace(/\.?0+$/, '');
            if (formatted.endsWith('.')) {
                formatted = formatted.slice(0, -1);
            }
        }
        return formatted;
    }

    function showResult(text) {
        resultEl.textContent = text;
        resultWrapper.classList.add("visible");
        container.classList.add('expanded');
        hideFeedback();
    }

    function hideResult() {
        resultEl.textContent = "";
        resultWrapper.classList.remove("visible");
        container.classList.remove('expanded');
    }

    function showFeedback(message) {
        inputFeedback.textContent = message;
        inputFeedback.style.opacity = '1';
        hideResult();
    }

    function hideFeedback() {
        inputFeedback.textContent = "";
        inputFeedback.style.opacity = '0';
    }

    function convertUnits() {
        const category = categorySelect.value;
        const from = fromUnitSelect.value;
        const to = toUnitSelect.value;
        const rawInputValue = inputValue.value.trim();

        if (from === 'no-match' || to === 'no-match') {
            hideResult();
            return;
        }

        if (rawInputValue === '') {
            hideResult();
            hideFeedback();
            lastCalculatedRawResult = null;
            clearInputButton.classList.remove('visible');
            return;
        }

        clearInputButton.classList.add('visible');

        const value = new Decimal(rawInputValue);

        if (value.isNaN()) {
            showFeedback("Please enter a valid number.");
            lastCalculatedRawResult = null;
            return;
        }

        hideFeedback();
        let convertedValue;

        if (category === "Temperature") {
            convertedValue = convertTemperatureRaw(value, from, to);
            showResult(`${formatSmart(convertedValue)} ${to}`);
            lastCalculatedRawResult = convertedValue.toString();
            return;
        }

        const base = new Decimal(unitsData[category][from]);
        const target = new Decimal(unitsData[category][to]);

        if (base.isNaN() || target.isNaN()) {
            showFeedback("Conversion data missing for selected units.");
            lastCalculatedRawResult = null;
            return;
        }
        if (target.isZero()) {
            showFeedback("Conversion to this unit is not possible (target factor is zero).");
            lastCalculatedRawResult = null;
            return;
        }
        convertedValue = value.times(base).dividedBy(target);
        showResult(`${formatSmart(convertedValue)} ${to}`);
        lastCalculatedRawResult = convertedValue.toString();
    }

    function convertTemperatureRaw(val, from, to) {
        if (from === to) return val;

        let celsius;

        if (from === "Celsius") celsius = val;
        else if (from === "Fahrenheit") celsius = val.minus(32).times(TEMP_CONVERSION_CONSTANT_5_9);
        else if (from === "Kelvin") celsius = val.minus(KELVIN_OFFSET);

        let converted;
        if (to === "Celsius") converted = celsius;
        else if (to === "Fahrenheit") converted = celsius.times(TEMP_CONVERSION_CONSTANT_9_5).plus(32);
        else if (to === "Kelvin") converted = celsius.plus(KELVIN_OFFSET);

        return converted;
    }

    flipIcon.addEventListener("click", () => {
        const tempFrom = fromUnitSelect.value;
        const tempTo = toUnitSelect.value;

        if (tempFrom && tempTo && tempFrom !== 'no-match' && tempTo !== 'no-match') {
            fromUnitFilter.value = "";
            toUnitFilter.value = "";

            populateUnits(fromUnitSelect, fromUnitFilter, clearFromUnitButton, tempTo);
            populateUnits(toUnitSelect, toUnitFilter, clearToUnitButton, tempFrom);
            
            fromUnitSelect.classList.add("glow");
            toUnitSelect.classList.add("glow");
            
            setTimeout(() => {
                fromUnitSelect.classList.remove("glow");
                toUnitSelect.classList.remove("glow");
            }, 600);
        }
    });

    resultEl.addEventListener("click", () => {
        const textToCopy = lastCalculatedRawResult !== null ? lastCalculatedRawResult : resultEl.textContent;

        if (!textToCopy || fromUnitSelect.value === 'no-match' || toUnitSelect.value === 'no-match') return;

        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                copyPopup.classList.add("show");
                setTimeout(() => {
                    copyPopup.classList.remove("show");
                }, 1500);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
            });
    });

    categorySelect.addEventListener("change", () => {
        fromUnitFilter.value = "";
        toUnitFilter.value = "";
        inputValue.value = '';
        hideResult();
        hideFeedback();
        clearInputButton.classList.remove('visible');
        lastCalculatedRawResult = null;

        populateUnits(fromUnitSelect, fromUnitFilter, clearFromUnitButton);
        populateUnits(toUnitSelect, toUnitFilter, clearToUnitButton);
        
        fromUnitSelect.classList.add("glow");
        toUnitSelect.classList.add("glow");
        setTimeout(() => {
            fromUnitSelect.classList.remove("glow");
            toUnitSelect.classList.remove("glow");
        }, 600);
    });

    fromUnitSelect.addEventListener("change", convertUnits);
    toUnitSelect.addEventListener("change", convertUnits);
    inputValue.addEventListener("input", convertUnits);
    
    fromUnitFilter.addEventListener("input", (event) => {
        event.target.value = event.target.value.replace(/[^a-zA-Z\s]/g, '');
        populateUnits(fromUnitSelect, fromUnitFilter, clearFromUnitButton, fromUnitSelect.value);
    });
    toUnitFilter.addEventListener("input", (event) => {
        event.target.value = event.target.value.replace(/[^a-zA-Z\s]/g, '');
        populateUnits(toUnitSelect, toUnitFilter, clearToUnitButton, toUnitSelect.value);
    });

    inputValue.addEventListener('input', () => {
        if (inputValue.value.trim() !== '') {
            clearInputButton.classList.add('visible');
        } else {
            clearInputButton.classList.remove('visible');
            hideFeedback();
        }
    });

    clearInputButton.addEventListener('click', () => {
        inputValue.value = '';
        hideResult();
        hideFeedback();
        clearInputButton.classList.remove('visible');
    });

    clearFromUnitButton.addEventListener('click', () => {
        fromUnitFilter.value = '';
        populateUnits(fromUnitSelect, fromUnitFilter, clearFromUnitButton);
    });

    clearToUnitButton.addEventListener('click', () => {
        toUnitFilter.value = '';
        populateUnits(toUnitSelect, toUnitFilter, clearToUnitButton);
    });

    populateCategories();

    const defaultCategory = "Area";
    const defaultIndex = [...categorySelect.options].findIndex(opt => opt.value === defaultCategory);
    categorySelect.selectedIndex = defaultIndex !== -1 ? defaultIndex : 0;

    populateUnits(fromUnitSelect, fromUnitFilter, clearFromUnitButton);
    populateUnits(toUnitSelect, toUnitFilter, clearToUnitButton);
    convertUnits();
});