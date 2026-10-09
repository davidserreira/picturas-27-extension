"""Pure Pillow operations shared by the image workers and UC-VID-003."""

from PIL import ImageOps


def resize(image, dimensions):
    return image.resize(dimensions)


def binarize(image, threshold):
    return ImageOps.grayscale(image).point(lambda value: 0 if value < threshold else 255)


def rotate(image, degrees, expand=True):
    return image.rotate(degrees, expand=expand)


def validate_chain(tools):
    if not isinstance(tools, list) or not 1 <= len(tools) <= 3:
        raise ValueError("Choose between one and three tools")
    for tool in tools:
        if not isinstance(tool, dict):
            raise ValueError("Invalid tool")
        kind = tool.get("type")
        if kind == "resize":
            for key in ("width", "height"):
                if type(tool.get(key)) is not int or not 16 <= tool[key] <= 3840:
                    raise ValueError("Dimensions must be integers between 16 and 3840")
        elif kind == "binarization":
            if type(tool.get("threshold")) is not int or not 0 <= tool["threshold"] <= 255:
                raise ValueError("Threshold must be an integer between 0 and 255")
        elif kind == "rotate":
            if type(tool.get("degrees")) is not int or tool["degrees"] not in (90, 180, 270):
                raise ValueError("Rotation must be 90, 180 or 270 degrees")
        else:
            raise ValueError("Unsupported tool")


def chain_dimensions(width, height, tools):
    for tool in tools:
        if tool["type"] == "resize":
            width, height = tool["width"], tool["height"]
        elif tool["type"] == "rotate" and tool["degrees"] in (90, 270):
            width, height = height, width
    return width, height


def apply_chain(image, tools):
    for tool in tools:
        if tool["type"] == "resize":
            image = resize(image, (tool["width"], tool["height"]))
        elif tool["type"] == "binarization":
            image = binarize(image, tool["threshold"])
        elif tool["type"] == "rotate":
            image = rotate(image, tool["degrees"])
        else:
            raise ValueError("Unsupported tool")
    return image
