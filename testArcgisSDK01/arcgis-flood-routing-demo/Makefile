dev:
	# Run backend and frontend concurrently
	bash -lc '(
	  cd backend && uvicorn app:app --reload --port $${BACKEND_PORT:-8000}
	) & (
	  cd frontend && npm run dev
	) && wait'
