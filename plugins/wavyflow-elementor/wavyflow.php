<?php
/**
 * Plugin Name: WavyFlow for Elementor
 * Description: Templates de landing page de alta conversao para Elementor. Widgets nativos editaveis com design premium.
 * Version: 1.0.0
 * Author: WavyFlow
 * Author URI: https://wavyflow.com
 * Text Domain: wavyflow
 * Requires Plugins: elementor
 * Elementor tested up to: 3.35
 */

if (!defined('ABSPATH')) exit;

define('WAVYFLOW_VERSION', '1.0.0');
define('WAVYFLOW_PATH', plugin_dir_path(__FILE__));
define('WAVYFLOW_URL', plugin_dir_url(__FILE__));

/**
 * Register WavyFlow widget category
 */
function wavyflow_add_elementor_category($elements_manager) {
    $elements_manager->add_category('wavyflow', [
        'title' => 'WavyFlow',
        'icon'  => 'fa fa-bolt',
    ]);
}
add_action('elementor/elements/categories_registered', 'wavyflow_add_elementor_category');

/**
 * Register widgets
 */
function wavyflow_register_widgets($widgets_manager) {
    require_once WAVYFLOW_PATH . 'widgets/urgency-bar.php';
    require_once WAVYFLOW_PATH . 'widgets/hero-vsl.php';
    require_once WAVYFLOW_PATH . 'widgets/split-section.php';
    require_once WAVYFLOW_PATH . 'widgets/manifesto.php';
    require_once WAVYFLOW_PATH . 'widgets/steps-grid.php';
    require_once WAVYFLOW_PATH . 'widgets/testimonials-grid.php';
    require_once WAVYFLOW_PATH . 'widgets/bonus-grid.php';
    require_once WAVYFLOW_PATH . 'widgets/pricing-card.php';
    require_once WAVYFLOW_PATH . 'widgets/mentor-section.php';
    require_once WAVYFLOW_PATH . 'widgets/faq-accordion.php';
    require_once WAVYFLOW_PATH . 'widgets/footer-minimal.php';
    require_once WAVYFLOW_PATH . 'widgets/wavyflow-section.php';

    $widgets_manager->register(new \WavyFlow\Widgets\WavyFlow_Section());
    $widgets_manager->register(new \WavyFlow\Widgets\Urgency_Bar());
    $widgets_manager->register(new \WavyFlow\Widgets\Hero_VSL());
    $widgets_manager->register(new \WavyFlow\Widgets\Split_Section());
    $widgets_manager->register(new \WavyFlow\Widgets\Manifesto());
    $widgets_manager->register(new \WavyFlow\Widgets\Steps_Grid());
    $widgets_manager->register(new \WavyFlow\Widgets\Testimonials_Grid());
    $widgets_manager->register(new \WavyFlow\Widgets\Bonus_Grid());
    $widgets_manager->register(new \WavyFlow\Widgets\Pricing_Card());
    $widgets_manager->register(new \WavyFlow\Widgets\Mentor_Section());
    $widgets_manager->register(new \WavyFlow\Widgets\FAQ_Accordion());
    $widgets_manager->register(new \WavyFlow\Widgets\Footer_Minimal());
}
add_action('elementor/widgets/register', 'wavyflow_register_widgets');

/**
 * Enqueue frontend styles
 */
function wavyflow_enqueue_styles() {
    wp_enqueue_style('wavyflow-base', WAVYFLOW_URL . 'assets/css/wavyflow-base.css', [], WAVYFLOW_VERSION);
    wp_enqueue_style('wavyflow-figtree', 'https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap', [], null);
}
add_action('elementor/frontend/after_enqueue_styles', 'wavyflow_enqueue_styles');

/**
 * Enqueue editor styles (preview inside Elementor)
 */
function wavyflow_editor_styles() {
    wp_enqueue_style('wavyflow-base', WAVYFLOW_URL . 'assets/css/wavyflow-base.css', [], WAVYFLOW_VERSION);
    wp_enqueue_style('wavyflow-editor', WAVYFLOW_URL . 'assets/css/wavyflow-editor.css', ['wavyflow-base'], WAVYFLOW_VERSION);
    wp_enqueue_style('wavyflow-figtree', 'https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap', [], null);
}
add_action('elementor/editor/after_enqueue_styles', 'wavyflow_editor_styles');
add_action('elementor/preview/enqueue_styles', 'wavyflow_editor_styles');

/**
 * Enqueue frontend scripts
 */
function wavyflow_enqueue_scripts() {
    wp_enqueue_script('wavyflow-front', WAVYFLOW_URL . 'assets/js/wavyflow-front.js', [], WAVYFLOW_VERSION, true);
}
add_action('elementor/frontend/after_enqueue_scripts', 'wavyflow_enqueue_scripts');

/**
 * ─── Admin Menu: Import from WavyFlow ───
 */
function wavyflow_admin_menu() {
    add_menu_page(
        'WavyFlow',
        'WavyFlow',
        'edit_posts',
        'wavyflow',
        'wavyflow_import_page',
        'dashicons-layout',
        59
    );
}
add_action('admin_menu', 'wavyflow_admin_menu');

function wavyflow_import_page() {
    ?>
    <style>
        .wf-admin{max-width:640px;margin:40px auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .wf-admin h1{font-size:24px;font-weight:600;margin-bottom:8px}
        .wf-admin .wf-sub{color:#888;font-size:14px;margin-bottom:32px}
        .wf-admin .wf-card{background:#1e1e1e;border-radius:16px;padding:32px;border:1px solid #333}
        .wf-admin .wf-steps{list-style:none;padding:0;margin:0 0 24px;counter-reset:s}
        .wf-admin .wf-steps li{counter-increment:s;padding:8px 0 8px 32px;position:relative;color:#aaa;font-size:13px}
        .wf-admin .wf-steps li::before{content:counter(s);position:absolute;left:0;top:8px;width:20px;height:20px;border-radius:50%;background:#333;color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center}
        .wf-admin .wf-paste-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px;border-radius:12px;border:2px dashed #444;background:#111;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.3s}
        .wf-admin .wf-paste-btn:hover{border-color:#1db954;background:#0a1f0f}
        .wf-admin .wf-paste-btn.wf-success{border-color:#1db954;background:#0a1f0f;color:#1db954}
        .wf-admin .wf-paste-btn.wf-error{border-color:#ef4444;color:#ef4444}
        .wf-admin .wf-status{margin-top:16px;font-size:13px;text-align:center;min-height:20px}
        .wf-admin .wf-or{text-align:center;color:#555;font-size:12px;margin:16px 0}
        .wf-admin .wf-file-area{display:flex;gap:8px}
        .wf-admin .wf-file-area input[type=file]{flex:1;color:#aaa;font-size:13px}
        .wf-admin .wf-file-btn{padding:8px 20px;border-radius:8px;background:#1db954;color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer}
        .wf-admin .wf-file-btn:hover{background:#1aa34a}
        .wf-admin .wf-templates{margin-top:32px}
        .wf-admin .wf-templates h3{font-size:14px;color:#888;margin-bottom:12px}
        .wf-admin .wf-tpl-list{display:flex;flex-direction:column;gap:8px}
        .wf-admin .wf-tpl-item{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#1e1e1e;border:1px solid #333;border-radius:10px}
        .wf-admin .wf-tpl-item span{color:#ddd;font-size:13px}
        .wf-admin .wf-tpl-item small{color:#666;font-size:11px}
    </style>
    <div class="wf-admin">
        <h1>WavyFlow</h1>
        <p class="wf-sub">Importe templates do WavyFlow direto para o Elementor.</p>

        <div class="wf-card">
            <ol class="wf-steps">
                <li>No WavyFlow, clique em <strong style="color:#fff">Elementor</strong> → <strong style="color:#fff">Baixar .json</strong></li>
                <li>Aqui, clique em <strong style="color:#1db954">Colar do clipboard</strong> ou selecione o arquivo .json</li>
                <li>O template aparece em <strong style="color:#fff">Templates &gt; Saved Templates</strong></li>
                <li>No Elementor, insira o template na pagina</li>
            </ol>

            <button id="wf-paste-btn" class="wf-paste-btn" onclick="wavyflowPasteFromClipboard()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                Colar do clipboard
            </button>

            <p id="wf-status" class="wf-status"></p>

            <p class="wf-or">— ou —</p>

            <form method="post" enctype="multipart/form-data" class="wf-file-area">
                <?php wp_nonce_field('wavyflow_import', 'wf_nonce'); ?>
                <input type="file" name="wf_json_file" accept=".json">
                <button type="submit" name="wf_import_file" class="wf-file-btn">Importar arquivo</button>
            </form>
        </div>

        <?php
        // Handle file upload import
        if (isset($_POST['wf_import_file']) && isset($_FILES['wf_json_file']) && check_admin_referer('wavyflow_import', 'wf_nonce')) {
            $file = $_FILES['wf_json_file'];
            if ($file['error'] === UPLOAD_ERR_OK && $file['size'] > 0) {
                $json = file_get_contents($file['tmp_name']);
                $data = json_decode($json, true);
                if ($data && isset($data['content'])) {
                    $result = wavyflow_create_elementor_template($data);
                    if ($result) {
                        echo '<div style="margin-top:16px;padding:12px 16px;background:#0a1f0f;border:1px solid #1db954;border-radius:8px;color:#1db954;font-size:13px">Template importado com sucesso! Va em Templates &gt; Saved Templates para inserir.</div>';
                    } else {
                        echo '<div style="margin-top:16px;padding:12px 16px;background:#1f0a0a;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-size:13px">Erro ao criar template.</div>';
                    }
                } else {
                    echo '<div style="margin-top:16px;padding:12px 16px;background:#1f0a0a;border:1px solid #ef4444;border-radius:8px;color:#ef4444;font-size:13px">JSON invalido.</div>';
                }
            }
        }
        ?>
    </div>

    <script>
    async function wavyflowPasteFromClipboard() {
        const btn = document.getElementById('wf-paste-btn');
        const status = document.getElementById('wf-status');
        try {
            const text = await navigator.clipboard.readText();
            const data = JSON.parse(text);
            if (!data.content) throw new Error('JSON nao e um template WavyFlow valido');

            btn.textContent = 'Importando...';
            btn.disabled = true;

            const res = await fetch(ajaxurl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'wavyflow_import_template',
                    nonce: '<?php echo wp_create_nonce("wavyflow_ajax_import"); ?>',
                    template_json: JSON.stringify(data),
                }),
            });

            const result = await res.json();
            if (result.success) {
                btn.className = 'wf-paste-btn wf-success';
                btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Template importado!';
                status.style.color = '#1db954';
                status.textContent = 'Va em Templates > Saved Templates ou insira direto no Elementor.';
            } else {
                throw new Error(result.data || 'Erro ao importar');
            }
        } catch (err) {
            btn.className = 'wf-paste-btn wf-error';
            btn.innerHTML = 'Erro — tente novamente';
            status.style.color = '#ef4444';
            status.textContent = err.message || 'Nao foi possivel ler o clipboard. Copie o JSON no WavyFlow primeiro.';
            setTimeout(() => {
                btn.className = 'wf-paste-btn';
                btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Colar do clipboard';
            }, 3000);
        }
    }
    </script>
    <?php
}

/**
 * AJAX handler for clipboard import
 */
function wavyflow_ajax_import_template() {
    check_ajax_referer('wavyflow_ajax_import', 'nonce');

    if (!current_user_can('edit_posts')) {
        wp_send_json_error('Sem permissao');
    }

    $json = isset($_POST['template_json']) ? $_POST['template_json'] : '';
    $data = json_decode(stripslashes($json), true);

    if (!$data || !isset($data['content'])) {
        wp_send_json_error('JSON invalido');
    }

    $result = wavyflow_create_elementor_template($data);
    if ($result) {
        wp_send_json_success(['id' => $result]);
    } else {
        wp_send_json_error('Erro ao criar template');
    }
}
add_action('wp_ajax_wavyflow_import_template', 'wavyflow_ajax_import_template');

/**
 * Create Elementor template from JSON data
 */
function wavyflow_create_elementor_template($data) {
    $title = isset($data['title']) ? sanitize_text_field($data['title']) : 'WavyFlow Template';
    $content = isset($data['content']) ? $data['content'] : [];

    // Create a new Elementor template post
    $post_id = wp_insert_post([
        'post_title'  => $title . ' — ' . date('d/m H:i'),
        'post_status' => 'publish',
        'post_type'   => 'elementor_library',
    ]);

    if (is_wp_error($post_id)) return false;

    // Set Elementor meta — wp_slash is required because update_post_meta runs stripslashes_deep
    $encoded = wp_json_encode($content);
    update_post_meta($post_id, '_elementor_data', wp_slash($encoded));
    update_post_meta($post_id, '_elementor_edit_mode', 'builder');
    update_post_meta($post_id, '_elementor_template_type', 'page');
    update_post_meta($post_id, '_elementor_version', '3.35.0');
    update_post_meta($post_id, '_elementor_page_settings', []);
    update_post_meta($post_id, '_wp_page_template', 'elementor_canvas');

    // Clear Elementor CSS cache for this post
    delete_post_meta($post_id, '_elementor_css');
    delete_transient('elementor_css_' . $post_id);

    // Set template type taxonomy
    wp_set_object_terms($post_id, 'page', 'elementor_library_type');

    return $post_id;
}

/**
 * REST API endpoint for direct import from WavyFlow
 */
function wavyflow_register_rest_routes() {
    register_rest_route('wavyflow/v1', '/import', [
        'methods'  => 'POST',
        'callback' => 'wavyflow_rest_import',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        },
    ]);
}
add_action('rest_api_init', 'wavyflow_register_rest_routes');

function wavyflow_rest_import($request) {
    $data = $request->get_json_params();
    if (!$data || !isset($data['content'])) {
        return new \WP_Error('invalid', 'JSON invalido', ['status' => 400]);
    }
    $result = wavyflow_create_elementor_template($data);
    if ($result) {
        return ['success' => true, 'post_id' => $result];
    }
    return new \WP_Error('failed', 'Erro ao criar template', ['status' => 500]);
}
