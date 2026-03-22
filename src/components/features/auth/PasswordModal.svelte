<script lang="ts">
	import I18nKey from "@i18n/i18nKey";
	import { i18n } from "@i18n/translation";
	import { onMount } from "svelte";

	let errorMessage = $state("");
	let isLoading = $state(false);
	let password = $state("");

	function dispatchUnlock(password: string) {
		const event = new CustomEvent("password:unlock", {
			detail: { password },
			bubbles: true,
			composed: true,
		});
		document.dispatchEvent(event);
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (password.trim()) {
			dispatchUnlock(password);
		}
	}

	function handleKeypress(e: KeyboardEvent) {
		if (e.key === "Enter" && password.trim()) {
			dispatchUnlock(password);
		}
	}

	onMount(() => {
		const handleLoading = ((e: CustomEvent<boolean>) => {
			isLoading = e.detail;
		}) as EventListener;

		const handleError = ((e: CustomEvent<string>) => {
			errorMessage = e.detail;
			isLoading = false;
		}) as EventListener;

		const handleClearError = (() => {
			errorMessage = "";
		}) as EventListener;

		document.addEventListener("password:loading", handleLoading);
		document.addEventListener("password:error", handleError);
		document.addEventListener("password:clear-error", handleClearError);

		return () => {
			document.removeEventListener("password:loading", handleLoading);
			document.removeEventListener("password:error", handleError);
			document.removeEventListener(
				"password:clear-error",
				handleClearError,
			);
		};
	});
</script>

<div class="password-protection">
	<div class="password-container">
		<div class="lock-icon">
			<svg
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				class="w-12 h-12"
			>
				<path
					d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"
					fill="currentColor"
				></path>
			</svg>
		</div>
		<h2>{i18n(I18nKey.passwordProtectedTitle)}</h2>
		<p>{i18n(I18nKey.passwordProtectedDescription)}</p>
		<form class="password-input-group" onsubmit={handleSubmit}>
			<input
				type="password"
				id="password-input"
				placeholder={i18n(I18nKey.passwordPlaceholder)}
				class="password-input"
				bind:value={password}
				onkeypress={handleKeypress}
				disabled={isLoading}
			/>
			<button
				id="unlock-btn"
				class="unlock-button"
				type="submit"
				disabled={isLoading}
			>
				{isLoading
					? i18n(I18nKey.passwordUnlocking)
					: i18n(I18nKey.passwordUnlock)}
			</button>
		</form>
		{#if errorMessage}
			<div class="error-message">{errorMessage}</div>
		{/if}
	</div>
</div>

<style>
	.password-protection {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 60vh;
		padding: 2rem;
	}

	.password-container {
		text-align: center;
		max-width: 25rem;
		width: 100%;
		padding: 2rem;
		border-radius: 12px;
		background: transparent;
		border: 1px solid var(--line-divider);
		box-shadow: none;
	}

	.lock-icon {
		display: flex;
		justify-content: center;
		margin-bottom: 1rem;
		color: var(--primary);
	}

	.lock-icon svg {
		width: 3rem;
		height: 3rem;
	}

	.password-container h2 {
		margin-bottom: 0.5rem;
		color: rgba(0, 0, 0, 0.85);
		font-size: 1.5rem;
	}

	:global(.dark) .password-container h2 {
		color: rgba(255, 255, 255, 0.85);
	}

	.password-container p {
		margin-bottom: 1.5rem;
		color: rgba(0, 0, 0, 0.75);
		opacity: 0.8;
	}

	:global(.dark) .password-container p {
		color: rgba(255, 255, 255, 0.75);
	}

	.password-input-group {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		align-items: stretch;
	}

	.password-input {
		flex: 1;
		min-width: 0;
		padding: 0.75rem 1rem;
		border: 1px solid var(--line-divider);
		border-radius: 8px;
		background: transparent;
		color: rgba(0, 0, 0, 0.85);
		font-size: 1rem;
		transition: border-color 0.2s ease;
	}

	:global(.dark) .password-input {
		color: rgba(255, 255, 255, 0.85);
	}

	.password-input::placeholder {
		color: rgba(0, 0, 0, 0.5);
	}

	:global(.dark) .password-input::placeholder {
		color: rgba(255, 255, 255, 0.5);
	}

	.password-input:focus {
		outline: none;
		border-color: var(--primary);
	}

	.unlock-button {
		padding: 0.75rem 1.5rem;
		background: transparent;
		color: var(--primary);
		border: 1px solid var(--primary);
		border-radius: 8px;
		font-size: 1rem;
		cursor: pointer;
		transition:
			border-color 0.2s,
			color 0.2s,
			background 0.2s;
		white-space: nowrap;
		flex-shrink: 0;
		min-width: fit-content;
		max-width: max-content;
	}

	.unlock-button:hover:not(:disabled) {
		background: var(--primary);
		color: white;
		border-color: var(--primary);
	}

	.unlock-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-message {
		color: #ef4444;
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	@media (min-width: 769px) {
		.password-input-group {
			flex-wrap: nowrap;
		}

		.unlock-button {
			max-width: 40%;
		}
	}

	@media (max-width: 768px) {
		.password-protection {
			padding: 1rem;
			min-height: 50vh;
		}

		.password-container {
			max-width: none;
			width: 100%;
			padding: 1.5rem;
			margin: 0 0.5rem;
		}

		.password-container h2 {
			font-size: 1.25rem;
			margin-bottom: 0.75rem;
		}

		.password-container p {
			font-size: 0.9rem;
			margin-bottom: 1.25rem;
		}

		.password-input-group {
			flex-direction: column;
			gap: 0.75rem;
		}

		.password-input {
			padding: 0.875rem 1rem;
			font-size: 1rem;
			width: 100%;
		}

		.unlock-button {
			padding: 0.875rem 1rem;
			font-size: 1rem;
			max-width: 100%;
			width: 100%;
			white-space: nowrap;
		}

		.error-message {
			font-size: 0.8rem;
			text-align: center;
		}
	}

	@media (max-width: 480px) {
		.password-protection {
			padding: 0.75rem;
		}

		.password-container {
			padding: 1.25rem;
			margin: 0 0.25rem;
		}

		.password-container h2 {
			font-size: 1.125rem;
		}

		.password-container p {
			font-size: 0.85rem;
		}

		.password-input {
			padding: 0.75rem 0.875rem;
			font-size: 0.95rem;
		}

		.unlock-button {
			padding: 0.75rem 0.875rem;
			font-size: 0.95rem;
		}
	}
</style>
