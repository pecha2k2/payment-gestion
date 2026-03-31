.PHONY: build run dev clean

# Build frontend only
build-frontend:
	cd frontend && npm install && npm run build

# Start everything with docker-compose (builds frontend first)
run: build-frontend
	mkdir -p postgres/data backups/database
	docker-compose up -d --build

# Start only (after first run, no frontend rebuild)
start:
	docker-compose up -d

# Stop everything
stop:
	docker-compose down

# Restart app container only (after code changes)
restart-app:
	docker-compose restart app

# View logs
logs:
	docker-compose logs -f app

# Rebuild and restart (full)
rebuild: build-frontend restart-app

# Development - frontend only
dev:
	cd frontend && npm run dev

# Development - backend only (needs DB running locally or external)
dev-backend:
	cd app && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# Backup database (from running container)
backup-db:
	docker exec payment-gestion pg_dump -U postgres payment_gestion > backups/database/backup_$$(date +%Y%m%d_%H%M%S).sql

# Shell into container
shell:
	docker exec -it payment-gestion /bin/bash
