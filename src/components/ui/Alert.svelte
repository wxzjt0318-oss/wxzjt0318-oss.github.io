<script lang="ts">
    export let message: string = '';
    export let type: 'info' | 'warning' | 'error' | 'success' = 'info';
    export let onClose: () => void = () => {};
</script>

<div
    class="rounded-md p-4 mb-4 border"
    class:bg-blue-50={type === 'info'}
    class:border-blue-200={type === 'info'}
    class:text-blue-700={type === 'info'}
    class:bg-yellow-50={type === 'warning'}
    class:border-yellow-200={type === 'warning'}
    class:text-yellow-700={type === 'warning'}
    class:bg-red-50={type === 'error'}
    class:border-red-200={type === 'error'}
    class:text-red-700={type === 'error'}
    class:bg-green-50={type === 'success'}
    class:border-green-200={type === 'success'}
    class:text-green-700={type === 'success'}
    role="alert"
>
    <div class="flex">
        <div class="flex-shrink-0">
            <!-- Icons -->
            {#if type === 'error'}
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
            {:else if type === 'warning'}
                <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
            {:else}
                <svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
            {/if}
        </div>
        <div class="ml-3">
            <p class="text-sm font-medium">
                {message}
            </p>
        </div>
        <div class="ml-auto pl-3">
            <div class="-mx-1.5 -my-1.5">
                <button
                    on:click={onClose}
                    type="button"
                    class="inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    class:text-blue-500={type === 'info'}
                    class:hover:bg-blue-100={type === 'info'}
                    class:focus:ring-blue-600={type === 'info'}
                    class:text-yellow-500={type === 'warning'}
                    class:hover:bg-yellow-100={type === 'warning'}
                    class:focus:ring-yellow-600={type === 'warning'}
                    class:text-red-500={type === 'error'}
                    class:hover:bg-red-100={type === 'error'}
                    class:focus:ring-red-600={type === 'error'}
                >
                    <span class="sr-only">Dismiss</span>
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L10 10 5.707 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
</div>
