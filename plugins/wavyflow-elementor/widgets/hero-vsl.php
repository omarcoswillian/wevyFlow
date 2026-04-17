<?php
namespace WavyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;

if (!defined('ABSPATH')) exit;

class Hero_VSL extends Widget_Base {
    public function get_name() { return 'wf-hero-vsl'; }
    public function get_title() { return 'WavyFlow Hero VSL'; }
    public function get_icon() { return 'eicon-play-o'; }
    public function get_categories() { return ['wavyflow']; }

    protected function register_controls() {
        $this->start_controls_section('content', ['label' => 'Conteudo']);
        $this->add_control('badge', ['label' => 'Badge', 'type' => Controls_Manager::TEXT, 'default' => 'Vagas limitadas · Ultima turma do ano']);
        $this->add_control('headline', ['label' => 'Headline', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Descubra o unico metodo que transforma suas leituras em PIX, mesmo que voce nao leia dezenas de livros por ano']);
        $this->add_control('highlight_word', ['label' => 'Palavra destaque', 'type' => Controls_Manager::TEXT, 'default' => 'PIX']);
        $this->add_control('subtitle', ['label' => 'Subtitulo', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Do que adianta acumular pilhas de livros, investir tempo em leituras e cursos, se voce nao consegue aplicar o que aprendeu para ganhar mais?']);
        $this->add_control('show_video', ['label' => 'Mostrar video', 'type' => Controls_Manager::SWITCHER, 'default' => 'yes']);
        $this->add_control('video_embed', ['label' => 'Embed do video (HTML)', 'type' => Controls_Manager::TEXTAREA, 'default' => '', 'description' => 'Cole o embed do VTurb, YouTube, etc. Deixe vazio para placeholder.']);
        $this->add_control('cta_text', ['label' => 'Texto do CTA', 'type' => Controls_Manager::TEXT, 'default' => 'Quero entrar no RMX']);
        $this->add_control('cta_url', ['label' => 'Link do CTA', 'type' => Controls_Manager::URL, 'default' => ['url' => '#checkout']]);
        $this->end_controls_section();

        $this->start_controls_section('style_section', ['label' => 'Estilo', 'tab' => Controls_Manager::TAB_STYLE]);
        $this->add_control('bg_color_1', ['label' => 'Cor fundo topo', 'type' => Controls_Manager::COLOR, 'default' => '#1c0d22']);
        $this->add_control('bg_color_2', ['label' => 'Cor fundo base', 'type' => Controls_Manager::COLOR, 'default' => '#17091c']);
        $this->add_control('text_color', ['label' => 'Cor do texto', 'type' => Controls_Manager::COLOR, 'default' => '#f0e8f2']);
        $this->add_control('highlight_color', ['label' => 'Cor destaque', 'type' => Controls_Manager::COLOR, 'default' => '#d4b8dc']);
        $this->add_control('cta_color', ['label' => 'Cor do CTA', 'type' => Controls_Manager::COLOR, 'default' => '#1db954']);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $headline = esc_html($s['headline'] ?? '');
        $hw = esc_html($s['highlight_word'] ?? '');
        if ($hw && $hw !== '') {
            $headline = str_replace($hw, '<span class="wf-highlight">' . $hw . '</span>', $headline);
        }
        $cta_url = $s['cta_url'] ?? [];
        $url = is_array($cta_url) ? ($cta_url['url'] ?? '#') : '#';
        ?>
        <div class="wf-hero" style="background: linear-gradient(180deg, <?php echo esc_attr($s['bg_color_1']); ?> 0%, <?php echo esc_attr($s['bg_color_2']); ?> 100%);">
            <div class="wf-hero-bg" style="background: radial-gradient(ellipse 80% 60% at 50% 20%, rgba(212,184,220,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 70% at 30% 90%, rgba(138,122,144,0.14) 0%, transparent 65%), linear-gradient(180deg, <?php echo esc_attr($s['bg_color_1']); ?>, <?php echo esc_attr($s['bg_color_2']); ?>);"></div>
            <div class="wf-hero-body">
                <?php if ($s['badge']): ?>
                <div class="wf-hero-badge"><?php echo esc_html($s['badge']); ?></div>
                <?php endif; ?>

                <h1 style="color:<?php echo esc_attr($s['text_color']); ?>"><?php echo $headline; ?></h1>

                <?php if ($s['subtitle']): ?>
                <p class="wf-hero-sub"><?php echo esc_html($s['subtitle']); ?></p>
                <?php endif; ?>

                <?php if ($s['show_video'] === 'yes'): ?>
                <div class="wf-hero-video">
                    <?php if (!empty($s['video_embed'])): ?>
                        <?php echo $s['video_embed']; ?>
                    <?php else: ?>
                        <div class="wf-hero-play"></div>
                    <?php endif; ?>
                </div>
                <?php endif; ?>

                <a href="<?php echo esc_url($url); ?>" class="wf-btn wf-btn--solid wf-btn--xl" style="background:linear-gradient(90deg, <?php echo esc_attr($s['cta_color']); ?>, <?php echo esc_attr($s['cta_color']); ?>ee);">
                    <?php echo esc_html($s['cta_text']); ?>
                    <span class="wf-arrow">&rarr;</span>
                </a>
            </div>
        </div>
        <?php
    }
}
