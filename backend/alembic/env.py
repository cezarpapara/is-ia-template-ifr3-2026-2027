from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

from app import models  # noqa: F401  (importul inregistreaza tabelele in Base.metadata)
from app.config import settings
from app.database import Base

# Configurarea logurilor din alembic.ini
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Alembic compara aceste tabele (din models.py) cu baza de date la "revision --autogenerate"
target_metadata = Base.metadata


# Aplica migrarile direct pe baza de date din DATABASE_URL
def run_migrations() -> None:
    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


run_migrations()
