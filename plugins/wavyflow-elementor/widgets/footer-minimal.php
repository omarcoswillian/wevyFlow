<?php
namespace WavyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;

if (!defined('ABSPATH')) exit;

class Footer_Minimal extends Widget_Base {
    public function get_name() { return 'wf-footer-minimal'; }
    public function get_title() { return 'WavyFlow Footer'; }
    public function get_icon() { return 'eicon-footer'; }
    public function get_categories() { return ['wavyflow']; }

    protected function register_controls() {
        $this->start_controls_section('content', ['label' => 'Conteudo']);
        $this->add_control('brand', ['label' => 'Nome da marca', 'type' => Controls_Manager::TEXT, 'default' => 'Black Boutique']);
        $this->add_control('copyright', ['label' => 'Copyright', 'type' => Controls_Manager::TEXT, 'default' => '2025 Os Formagios. Todos os direitos reservados.']);
        $this->add_control('terms_url', ['label' => 'Link Termos', 'type' => Controls_Manager::URL, 'default' => ['url' => '#']]);
        $this->add_control('privacy_url', ['label' => 'Link Privacidade', 'type' => Controls_Manager::URL, 'default' => ['url' => '#']]);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $terms_url = $s['terms_url'] ?? [];
        $privacy_url = $s['privacy_url'] ?? [];
        $terms = is_array($terms_url) ? ($terms_url['url'] ?? '#') : '#';
        $privacy = is_array($privacy_url) ? ($privacy_url['url'] ?? '#') : '#';
        ?>
        <div class="wf-block">
            <div class="wf-foot">
                <div class="wf-foot-left">
                    <span class="wf-foot-logo"><?php echo esc_html($s['brand']); ?></span>
                    <span>&copy; <?php echo esc_html($s['copyright']); ?></span>
                </div>
                <div class="wf-foot-legal">
                    <a href="<?php echo esc_url($terms); ?>">Termos de uso</a>
                    <a href="<?php echo esc_url($privacy); ?>">Politica de privacidade</a>
                </div>
            </div>
        </div>
        <?php
    }
}
