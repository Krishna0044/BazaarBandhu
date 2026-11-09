
import re
import unicodedata
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from app.database.models import Product


# Common product names in English, Hindi, Telugu and Kannada.
# Add more aliases as needed.
PRODUCT_ALIASES = {
    "tomato": [
        "tomato", "tomatoes",
        "टमाटर", "तमाटर", "tamatar",
        "టమాటా", "టమాట", "టొమాటో",
        "ಟೊಮೇಟೊ", "ಟೊಮಾಟೊ"
    ],
    "potato": [
        "potato", "potatoes",
        "आलू", "aloo",
        "బంగాళాదుంప", "బంగాళదుంప",
        "ಆಲೂಗಡ್ಡೆ"
    ],
    "onion": [
        "onion", "onions",
        "प्याज", "प्याज़", "pyaz",
        "ఉల్లిపాయ", "ఉల్లిగడ్డ",
        "ಈರುಳ್ಳಿ"
    ],
    "carrot": [
        "carrot", "carrots",
        "गाजर", "gajar",
        "క్యారెట్",
        "ಕ್ಯಾರೆಟ್"
    ],
    "brinjal": [
        "brinjal", "eggplant",
        "बैंगन", "baingan",
        "వంకాయ",
        "ಬದನೆಕಾಯಿ"
    ],
    "cabbage": [
        "cabbage",
        "पत्ता गोभी", "patta gobhi",
        "క్యాబేజీ",
        "ಎಲೆಕೋಸು"
    ],
    "cauliflower": [
        "cauliflower",
        "फूलगोभी", "phool gobhi",
        "కాలీఫ్లవర్",
        "ಹೂಕೋಸು"
    ],
    "beans": [
        "beans",
        "सेम", "फली",
        "బీన్స్",
        "ಬೀನ್ಸ್"
    ],
    "chilli": [
        "chilli", "chili", "green chilli",
        "हरी मिर्च", "mirchi",
        "పచ్చిమిర్చి",
        "ಹಸಿಮೆಣಸಿನಕಾಯಿ"
    ],
    "cucumber": [
        "cucumber",
        "खीरा", "kheera",
        "దోసకాయ",
        "ಸೌತೆಕಾಯಿ"
    ],
    "apple": [
        "apple", "apples",
        "सेब", "seb",
        "ఆపిల్",
        "ಸೇಬು"
    ],
    "banana": [
        "banana", "bananas",
        "केला", "kela",
        "అరటిపండు",
        "ಬಾಳೆಹಣ್ಣು"
    ],
    "orange": [
        "orange", "oranges",
        "संतरा", "santra",
        "నారింజ",
        "ಕಿತ್ತಳೆ"
    ],
    "mango": [
        "mango", "mangoes",
        "आम", "aam",
        "మామిడి",
        "ಮಾವು"
    ]
}


NUM_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10,

    "एक": 1, "दो": 2, "तीन": 3, "चार": 4,
    "पांच": 5, "पाँच": 5, "छह": 6, "सात": 7,
    "आठ": 8, "नौ": 9, "दस": 10,

    "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3,
    "ನಾಲ್ಕು": 4, "ಐದು": 5,

    "ఒకటి": 1, "రెండు": 2, "మూడు": 3,
    "నాలుగు": 4, "ఐదు": 5
}


def normalize_text(value: str) -> str:
    """Normalize text for multilingual matching."""
    value = unicodedata.normalize("NFKC", value)
    return value.casefold().strip()


def find_product(
    transcript: str,
    products: list
) -> Optional[Product]:

    text = normalize_text(transcript)

    # First try direct product-name matching.
    for product in products:
        product_name = normalize_text(product.product_name)

        if product_name and product_name in text:
            return product

    # Then try multilingual aliases.
    for product in products:
        product_name = normalize_text(product.product_name)

        for canonical_name, aliases in PRODUCT_ALIASES.items():

            group = [canonical_name] + aliases

            normalized_aliases = [
                normalize_text(alias) for alias in group
            ]

            if product_name in normalized_aliases:
                for alias in normalized_aliases:
                    if alias and alias in text:
                        return product

    return None


def extract_numbers(text: str) -> list:
    """Extract numeric digits or supported number words."""

    numbers = [
        float(value)
        for value in re.findall(r"\d+(?:\.\d+)?", text)
    ]

    # If digits were found, use them.
    if numbers:
        return numbers

    normalized = normalize_text(text)

    # Match number words as individual tokens.
    for word, value in sorted(
        NUM_WORDS.items(),
        key=lambda item: len(item[0]),
        reverse=True
    ):
        if word in normalized:
            numbers.append(float(value))

    return numbers


def parse_sales_intent(
    text: str,
    db: Session,
    vendor_id: int = 1
) -> Dict[str, Any]:

    text_lower = normalize_text(text)

    products = (
        db.query(Product)
        .filter(Product.vendor_id == vendor_id)
        .all()
    )

    matched_product = find_product(text, products)

    numbers = extract_numbers(text)

    quantity = None
    unit_price = None

    if len(numbers) >= 2:
        quantity = numbers[0]
        unit_price = numbers[1]

    elif len(numbers) == 1:
        quantity = numbers[0]

    # Detect unit.
    unit = "kg"

    unit_patterns = {
        "kg": ["kg", "kilogram", "kilograms", "kilo", "kilos"],
        "grams": ["grams", "gram", "g"],
        "litre": ["litre", "liter", "litres", "liters"],
        "piece": ["piece", "pieces"],
        "packet": ["packet", "packets"]
    }

    for standard_unit, aliases in unit_patterns.items():
        if any(alias in text_lower for alias in aliases):
            unit = standard_unit
            break

    if matched_product:
        product_unit = matched_product.unit
        available_stock = float(matched_product.quantity or 0)

        if unit == "kg" and product_unit:
            unit = product_unit
    else:
        product_unit = unit
        available_stock = 0.0

    if unit_price is None and matched_product:
        unit_price = float(matched_product.selling_price or 0)

    total_amount = None

    if quantity is not None and unit_price is not None:
        total_amount = round(quantity * unit_price, 2)

    error_message = None

    if not matched_product:
        error_message = (
            "Product not found. Please check the product name "
            "or add this product to your inventory."
        )

    elif quantity is None or quantity <= 0:
        error_message = "Please provide a valid sale quantity."

    elif unit_price is None or unit_price <= 0:
        error_message = "Please provide a valid selling price."

    elif quantity > available_stock:
        error_message = (
            f"Low stock alert! Available: {available_stock} "
            f"{product_unit}, requested: {quantity} {product_unit}."
        )

    result = {
        "transcript": text,
        "product_name": (
            matched_product.product_name if matched_product else None
        ),
        "matched_product_id": (
            matched_product.id if matched_product else None
        ),
        "quantity": quantity,
        "unit": product_unit,
        "unit_price": unit_price,
        "total_amount": total_amount,
        "requires_confirmation": True,
        "stock_available": available_stock,
        "error_message": error_message
    }

    return result
