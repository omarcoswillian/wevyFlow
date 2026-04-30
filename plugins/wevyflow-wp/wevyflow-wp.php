<?php
/**
 * Plugin Name:  WevyFlow
 * Plugin URI:   https://wevyflow.com
 * Description:  Importa e publica páginas criadas no WevyFlow diretamente no WordPress, sem depender de page builders.
 * Version:      1.0.0
 * Author:       WevyFlow
 * License:      GPL-2.0+
 * Text Domain:  wevyflow
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'WEVYFLOW_VERSION',   '1.0.0' );
define( 'WEVYFLOW_CPT',       'wevyflow_page' );
define( 'WEVYFLOW_META_HTML', '_wevyflow_html' );

/* ═══════════════════════════════════════════════════════════
   1. Custom Post Type
   ═══════════════════════════════════════════════════════════ */
add_action( 'init', function () {
    register_post_type( WEVYFLOW_CPT, [
        'labels' => [
            'name'               => 'WevyFlow Pages',
            'singular_name'      => 'WevyFlow Page',
            'add_new'            => 'Nova Página',
            'add_new_item'       => 'Nova Página WevyFlow',
            'edit_item'          => 'Editar Página',
            'view_item'          => 'Ver Página',
            'all_items'          => 'Todas as Páginas',
            'search_items'       => 'Buscar Páginas',
            'not_found'          => 'Nenhuma página encontrada.',
            'not_found_in_trash' => 'Nenhuma página na lixeira.',
        ],
        'public'        => true,
        'show_in_menu'  => true,
        'menu_icon'     => 'dashicons-layout',
        'menu_position' => 5,
        'supports'      => [ 'title' ],
        'rewrite'       => [ 'slug' => 'lp', 'with_front' => false ],
        'show_in_rest'  => true,
        'has_archive'   => false,
    ] );
} );

/* ═══════════════════════════════════════════════════════════
   2. Flush rewrite rules on activation
   ═══════════════════════════════════════════════════════════ */
register_activation_hook( __FILE__, function () {
    if ( ! post_type_exists( WEVYFLOW_CPT ) ) {
        register_post_type( WEVYFLOW_CPT, [
            'public'  => true,
            'rewrite' => [ 'slug' => 'lp', 'with_front' => false ],
        ] );
    }
    flush_rewrite_rules();
} );

register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );

/* ═══════════════════════════════════════════════════════════
   3. Meta Box
   ═══════════════════════════════════════════════════════════ */
add_action( 'add_meta_boxes', function () {
    add_meta_box(
        'wevyflow_import_box',
        'Código WevyFlow',
        'wevyflow_render_meta_box',
        WEVYFLOW_CPT,
        'normal',
        'high'
    );
} );

function wevyflow_render_meta_box( WP_Post $post ) {
    $has_html = (bool) get_post_meta( $post->ID, WEVYFLOW_META_HTML, true );
    wp_nonce_field( 'wevyflow_save_' . $post->ID, 'wevyflow_nonce' );
    $error = isset( $_GET['wf_error'] ) ? sanitize_key( $_GET['wf_error'] ) : '';
    ?>
    <style>
        .wf-box{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .wf-notice{display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:8px;margin-bottom:16px}
        .wf-notice.success{background:#f0fdf4;border:1px solid #86efac}
        .wf-notice.error{background:#fef2f2;border:1px solid #fca5a5}
        .wf-notice-icon{font-size:18px;line-height:1;margin-top:1px}
        .wf-notice-title{font-weight:600;font-size:13px}
        .wf-notice-desc{font-size:11px;color:#6b7280;margin-top:2px}
        .wf-notice.success .wf-notice-title{color:#15803d}
        .wf-notice.error .wf-notice-title{color:#dc2626}
        .wf-steps{display:flex;gap:0;margin-bottom:16px}
        .wf-step{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:#6b7280;text-align:center}
        .wf-step-num{width:24px;height:24px;border-radius:50%;background:#6366f1;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
        .wf-step-sep{flex:1;height:2px;background:#e5e7eb;margin-top:11px}
        .wf-label{font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;display:block}
        .wf-textarea{width:100%;box-sizing:border-box;font-family:monospace;font-size:11px;padding:10px 12px;border:1.5px solid #d1d5db;border-radius:8px;resize:vertical;min-height:120px;color:#111827;background:#fafafa;transition:border-color .15s}
        .wf-textarea:focus{outline:none;border-color:#6366f1;background:#fff}
        .wf-hint{font-size:11px;color:#9ca3af;margin-top:6px}
        .wf-btn-view{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#6366f1;color:#fff!important;border-radius:7px;font-size:12px;font-weight:600;text-decoration:none;margin-top:12px}
        .wf-btn-view:hover{background:#4f46e5}
    </style>
    <div class="wf-box">
        <?php if ( $has_html && ! $error ) : ?>
        <div class="wf-notice success">
            <div class="wf-notice-icon">✅</div>
            <div>
                <div class="wf-notice-title">Página importada com sucesso</div>
                <div class="wf-notice-desc">Cole um novo código abaixo e salve para atualizar. &nbsp;·&nbsp; <a href="<?php echo esc_url( get_permalink( $post->ID ) ); ?>" target="_blank">Ver página publicada →</a></div>
            </div>
        </div>
        <?php endif; ?>
        <?php if ( $error === 'invalid_code' ) : ?>
        <div class="wf-notice error">
            <div class="wf-notice-icon">⚠️</div>
            <div>
                <div class="wf-notice-title">Código inválido</div>
                <div class="wf-notice-desc">Certifique-se de copiar o código completo gerado pelo WevyFlow (começa com <code>{"wf":1</code>).</div>
            </div>
        </div>
        <?php endif; ?>

        <div class="wf-steps">
            <div class="wf-step"><div class="wf-step-num">1</div><span>Crie a página<br>no WevyFlow</span></div>
            <div class="wf-step-sep"></div>
            <div class="wf-step"><div class="wf-step-num">2</div><span>Clique em<br>"WordPress"</span></div>
            <div class="wf-step-sep"></div>
            <div class="wf-step"><div class="wf-step-num">3</div><span>Cole o código<br>aqui abaixo</span></div>
            <div class="wf-step-sep"></div>
            <div class="wf-step"><div class="wf-step-num">4</div><span>Salve e<br>publique</span></div>
        </div>

        <label class="wf-label" for="wevyflow_code">Código WevyFlow</label>
        <textarea name="wevyflow_code" id="wevyflow_code" class="wf-textarea"
            placeholder='Cole aqui o código gerado pelo WevyFlow (começa com {"wf":1,...})'
            autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
        <p class="wf-hint">
            <?php echo $has_html
                ? 'Código armazenado. Cole um novo código acima apenas para atualizar a página.'
                : 'Não altere o código manualmente. Copie sempre direto do WevyFlow.'; ?>
        </p>
        <?php if ( $has_html ) : ?>
        <a href="<?php echo esc_url( get_permalink( $post->ID ) ); ?>" target="_blank" class="wf-btn-view">
            Ver página publicada →
        </a>
        <?php endif; ?>
    </div>
    <?php
}

/* ═══════════════════════════════════════════════════════════
   4. Salvar meta
   ═══════════════════════════════════════════════════════════ */
add_action( 'save_post', function ( $post_id ) {
    if ( ! isset( $_POST['wevyflow_nonce'] ) ) return;
    if ( ! wp_verify_nonce( $_POST['wevyflow_nonce'], 'wevyflow_save_' . $post_id ) ) return;
    if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
    if ( ! current_user_can( 'edit_post', $post_id ) ) return;
    if ( get_post_type( $post_id ) !== WEVYFLOW_CPT ) return;

    $raw = isset( $_POST['wevyflow_code'] ) ? trim( wp_unslash( $_POST['wevyflow_code'] ) ) : '';
    if ( empty( $raw ) ) return;

    $data = json_decode( $raw, true );

    if ( json_last_error() === JSON_ERROR_NONE && ! empty( $data['wf'] ) && ! empty( $data['html'] ) ) {
        $html = $data['html'];
        if ( ! empty( $data['title'] ) ) {
            $current = get_the_title( $post_id );
            if ( empty( $current ) || $current === __( 'Auto Draft' ) ) {
                remove_action( 'save_post', __FUNCTION__ );
                wp_update_post( [ 'ID' => $post_id, 'post_title' => sanitize_text_field( $data['title'] ), 'post_name' => sanitize_title( $data['title'] ) ] );
                add_action( 'save_post', __FUNCTION__ );
            }
        }
    } elseif ( str_starts_with( trim( $raw ), '<!DOCTYPE' ) || str_starts_with( trim( $raw ), '<html' ) ) {
        $html = $raw;
    } else {
        add_filter( 'redirect_post_location', fn( $loc ) => add_query_arg( 'wf_error', 'invalid_code', $loc ) );
        return;
    }

    update_post_meta( $post_id, WEVYFLOW_META_HTML, $html );
} );

/* ═══════════════════════════════════════════════════════════
   5. Full-page template override
   ═══════════════════════════════════════════════════════════ */
add_filter( 'template_include', function ( $template ) {
    if ( ! is_singular( WEVYFLOW_CPT ) ) return $template;
    $tpl = plugin_dir_path( __FILE__ ) . 'template-full.php';
    return file_exists( $tpl ) ? $tpl : $template;
} );

/* ═══════════════════════════════════════════════════════════
   6. Shortcode [wevyflow_embed id="123" height="100vh"]
   ═══════════════════════════════════════════════════════════ */
add_shortcode( 'wevyflow_embed', function ( $atts ) {
    $atts = shortcode_atts( [ 'id' => 0, 'height' => '100vh' ], $atts, 'wevyflow_embed' );
    $post_id = absint( $atts['id'] );
    if ( ! $post_id || get_post_type( $post_id ) !== WEVYFLOW_CPT ) return '';
    return sprintf(
        '<iframe src="%s" title="%s" style="width:100%%;height:%s;border:none;display:block" loading="lazy" allowfullscreen></iframe>',
        esc_url( get_permalink( $post_id ) ),
        esc_attr( get_the_title( $post_id ) ),
        esc_attr( $atts['height'] )
    );
} );

/* ═══════════════════════════════════════════════════════════
   7. REST API — pronto para Camada 2
   ═══════════════════════════════════════════════════════════ */
add_action( 'rest_api_init', function () {
    register_rest_route( 'wevyflow/v1', '/import', [
        'methods'             => WP_REST_Server::CREATABLE,
        'permission_callback' => fn() => current_user_can( 'edit_posts' ),
        'callback'            => 'wevyflow_rest_import',
        'args'                => [
            'html'        => [ 'required' => true,  'type' => 'string' ],
            'title'       => [ 'required' => false, 'type' => 'string',  'default' => 'WevyFlow Page' ],
            'slug'        => [ 'required' => false, 'type' => 'string',  'default' => '' ],
            'wp_post_id'  => [ 'required' => false, 'type' => 'integer', 'default' => 0 ],
        ],
    ] );
} );

function wevyflow_rest_import( WP_REST_Request $req ): WP_REST_Response {
    $html    = $req->get_param( 'html' );
    $title   = sanitize_text_field( $req->get_param( 'title' ) );
    $slug    = sanitize_title( $req->get_param( 'slug' ) ?: $title );
    $post_id = absint( $req->get_param( 'wp_post_id' ) );

    if ( $post_id && get_post_type( $post_id ) === WEVYFLOW_CPT ) {
        wp_update_post( [ 'ID' => $post_id, 'post_title' => $title ] );
        update_post_meta( $post_id, WEVYFLOW_META_HTML, $html );
    } else {
        $post_id = wp_insert_post( [ 'post_type' => WEVYFLOW_CPT, 'post_title' => $title, 'post_name' => $slug, 'post_status' => 'publish' ], true );
        if ( is_wp_error( $post_id ) ) return new WP_REST_Response( [ 'error' => $post_id->get_error_message() ], 500 );
        update_post_meta( $post_id, WEVYFLOW_META_HTML, $html );
    }

    return new WP_REST_Response( [ 'post_id' => $post_id, 'url' => get_permalink( $post_id ), 'title' => $title ], 200 );
}

/* ═══════════════════════════════════════════════════════════
   8. Coluna de status na listagem admin
   ═══════════════════════════════════════════════════════════ */
add_filter( 'manage_' . WEVYFLOW_CPT . '_posts_columns', function ( $cols ) {
    $cols['wf_url']    = 'URL';
    $cols['wf_status'] = 'Código';
    return $cols;
} );

add_action( 'manage_' . WEVYFLOW_CPT . '_posts_custom_column', function ( $col, $post_id ) {
    if ( $col === 'wf_url' ) {
        echo '<a href="' . esc_url( get_permalink( $post_id ) ) . '" target="_blank" style="font-size:11px">' . esc_html( get_permalink( $post_id ) ) . ' ↗</a>';
    }
    if ( $col === 'wf_status' ) {
        $has = (bool) get_post_meta( $post_id, WEVYFLOW_META_HTML, true );
        echo $has ? '<span style="color:#16a34a;font-size:11px;font-weight:600">✓ Importado</span>' : '<span style="color:#dc2626;font-size:11px">⚠ Sem código</span>';
    }
}, 10, 2 );
