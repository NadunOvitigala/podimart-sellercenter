from app.store import Store, slugify


def unique_slug(store: Store, name: str) -> str:
    base = slugify(name)
    slug = base
    n = 2
    while store.get_seller_by_slug(slug):
        slug = f"{base}-{n}"
        n += 1
    return slug
